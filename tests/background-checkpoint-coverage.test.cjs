const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {Hub}=require('../desktop/hub.cjs');
const {Island,initialWorld}=require('../desktop/island.cjs');
const tick=()=>new Promise(setImmediate);
function fixture(t,initial={}){
 let stored=structuredClone(initial),sequence=0,hold=false,uncertain=false;
 const submissions=[];
 function submit(image,reason){
  const captured=structuredClone(image);let resolve,reject;
  const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const entry={image:captured,reason,commit(){stored=captured;resolve({epoch:'coverage-fixture',sequence:++sequence,stateSha256:createHash('sha256').update(JSON.stringify(captured)).digest('hex'),durableAt:Date.now()});},fail(error){reject(error);}};
  submissions.push(entry);if(!hold)entry.commit();return pending;
 }
 const store={load:()=>structuredClone(stored),barrier:submit,checkpoint:image=>submit(image,null),flush:async()=>null,close:async()=>{}};
 const hub=new Hub({home:process.cwd(),store,catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 t.after(async()=>{hold=false;for(const entry of submissions)entry.commit();await tick();try{await hub.close();}catch(error){if(!uncertain||error.code!=='COMMIT_UNCERTAIN')throw error;}});
 return {hub,submissions,get stored(){return stored;},hold(){hold=true;},release(){hold=false;},expectUncertain(){uncertain=true;}};
}
test('invalid resident edits leave all persisted fields unchanged',()=>{
 const hub={state:{world:initialWorld()},changed(){throw Error('invalid edits cannot publish');}};
 const island=new Island(hub),before=structuredClone(hub.state.world);
 assert.throws(()=>island.resident({id:'law',recruited:true,role:''}),/role/);
 assert.deepEqual(hub.state.world,before);
 assert.throws(()=>island.resident({id:'law',recruited:true,role:'Valid role',district:'missing'}),/district/);
 assert.deepEqual(hub.state.world,before);
 island.close();
});
test('cold background checkpoints persist derived recovery state despite equal initial generations',async t=>{
 const f=fixture(t,{tasks:[{id:'old',status:'working',messages:[]}],opaque:{unicode:'船'}});
 assert.equal(f.hub.savedGeneration,f.hub.dirtyGeneration);
 await f.hub.persist(null);
 assert.equal(f.submissions.length,1);
 assert.equal(f.stored.tasks[0].status,'unknown');
 assert.deepEqual(f.stored.opaque,{unicode:'船'});
 assert.equal(f.hub.recoveryReady,undefined,'background persistence cannot authorize startup recovery');
});
test('covered queued background checkpoint returns existing receipt without capturing or resubmitting',async t=>{
 const f=fixture(t);await f.hub.initializeRecovery();
 f.hub.state.settings.synthetic='exact durable value';f.hub.markDirty();f.hold();
 const required=f.hub.persist('mission');await tick();
 const background=f.hub.persist(null);const original=f.hub.persistedImage.bind(f.hub);let captures=0;
 f.hub.persistedImage=(...args)=>{captures++;return original(...args);};
 const pending=f.submissions.at(-1);f.release();pending.commit();
 const receipt=await required;assert.equal(await background,receipt);
 assert.equal(captures,0,'an already covered queued checkpoint must not clone the full profile');
 assert.equal(f.submissions.length,2,'only recovery and required barrier submit');
 assert.equal(f.stored.settings.synthetic,'exact durable value');
});
test('newer mutations during a required receipt still get a background checkpoint',async t=>{
 const f=fixture(t,{opaque:{future:['船']}});await f.hub.initializeRecovery();f.hold();
 f.hub.state.settings.synthetic='first';f.hub.markDirty();const required=f.hub.persist('mission');await tick();
 const background=f.hub.persist(null);f.hub.state.settings.synthetic='latest';f.hub.markDirty();
 f.release();f.submissions.at(-1).commit();await required;await background;
 assert.equal(f.submissions.length,3);assert.equal(f.stored.settings.synthetic,'latest');assert.deepEqual(f.stored.opaque,{future:['船']});
});
test('required barriers and explicitly validated checkpoints remain required when clean',async t=>{
 const f=fixture(t);await f.hub.initializeRecovery();
 for(const reason of ['mission','dispatch','reservation-release','acceptance','shutdown'])await f.hub.persist(reason);
 let validated=0;await f.hub.persist(null,()=>validated++);
 assert.equal(validated,2);assert.deepEqual(f.submissions.map(s=>s.reason),['mission','mission','dispatch','reservation-release','acceptance','shutdown',null]);
});
test('failed checkpoint is retried even if an earlier generation was acknowledged',async t=>{
 const f=fixture(t);await f.hub.initializeRecovery();f.hold();const pending=f.hub.persist('mission');await tick();
 f.submissions.at(-1).fail(Error('synthetic disk unavailable'));await assert.rejects(pending,/unavailable/);
 f.release();await f.hub.persist(null);assert.equal(f.submissions.length,3);assert.equal(f.hub.state.persistence.state,'saved');
});
for(const kind of ['missing','invalid-sha','wrong-epoch','stale-sequence'])test(`${kind} receipt cannot authorize a covered queued checkpoint skip`,async t=>{
 const f=fixture(t);await f.hub.initializeRecovery();f.hold();const required=f.hub.persist('mission');await tick();const background=f.hub.persist(null);
 f.hub.once('event',()=>{const receipt=f.hub.lastReceipt;f.hub.lastReceipt=kind==='missing'?null:{...receipt,...(kind==='invalid-sha'?{stateSha256:'invalid'}:kind==='wrong-epoch'?{epoch:'wrong'}:{sequence:receipt.sequence-1})};});
 f.release();f.submissions.at(-1).commit();await required;await background;
 assert.equal(f.submissions.length,3,'receipt proof is checked on the queued skip path');
});
test('queued checkpoints cannot use the first recovery receipt before initialization completes',async t=>{
 const f=fixture(t,{opaque:{future:'船'}});f.hold();const recovering=f.hub.initializeRecovery();await tick();const background=f.hub.persist(null);
 f.release();f.submissions.at(-1).commit();await recovering;await background;assert.equal(f.submissions.length,2);assert.equal(f.hub.recoveryReady,true);assert.deepEqual(f.stored.opaque,{future:'船'});
});
test('a new edit after the covered prepare keeps its own scheduled durability',async t=>{
 const f=fixture(t);await f.hub.initializeRecovery();const checkpoint=f.hub.authorityQueue.checkpoint.bind(f.hub.authorityQueue);let covered=false;
 f.hub.authorityQueue.checkpoint=prepare=>checkpoint(()=>{const prepared=prepare();if(prepared.skip){covered=true;queueMicrotask(()=>{f.hub.state.settings.synthetic='later microtask';f.hub.markDirty();f.hub.scheduleSave();});}return prepared;});
 f.hold();const required=f.hub.persist('mission');await tick();const background=f.hub.persist(null);
 f.release();f.submissions.at(-1).commit();await required;await background;
 assert.equal(covered,true);assert.ok(f.hub.dirtyGeneration>f.hub.savedGeneration);assert.ok(f.hub.saveTimer);await f.hub.savePending();assert.equal(f.stored.settings.synthetic,'later microtask');
});
test('uncertain storage rejects queued checkpoints rather than treating equal generations as durable',async t=>{
 const f=fixture(t);await f.hub.initializeRecovery();f.expectUncertain();
 f.hold();const required=f.hub.persist('mission');required.catch(()=>{});await tick();const background=f.hub.persist(null);background.catch(()=>{});
 f.submissions.at(-1).fail(Object.assign(Error('unknown commit'),{code:'COMMIT_UNCERTAIN',uncertain:true}));
 await assert.rejects(required,/unknown commit/);await assert.rejects(background,/unknown commit/);assert.equal(f.submissions.length,2);
});
test('failed recovery interruption marks its retained task outcome before an early throw',async t=>{
 const f=fixture(t,{tasks:[{id:'recovery',projectId:'p',crewId:'franky',status:'finished',messages:[]}]});await f.hub.initializeRecovery();
 const task=f.hub.state.tasks[0];task.toolDispatchIntent={id:'synthetic-intent'};f.hub.markDirty();await f.hub.persist('mission');
 await assert.rejects(f.hub.interrupt(task.id),/No known turn/);
 assert.equal(task.status,'unknown');assert.ok(f.hub.dirtyGeneration>f.hub.savedGeneration,'retained recovery outcome cannot share the old saved generation');
 await f.hub.persist(null);assert.equal(f.stored.tasks[0].status,'unknown');assert.match(f.stored.tasks[0].error,/unresolved/);
});
test('post-save captain stop failure remains dirty and is persisted by the next checkpoint',async t=>{
 const f=fixture(t,{tasks:[{id:'terminal',threadId:'synthetic-thread',turnId:'synthetic-turn',projectId:'p',crewId:'luffy',captain:true,status:'finished',messages:[]}]});await f.hub.initializeRecovery();
 const task=f.hub.state.tasks[0];task.status='working';f.hub.markDirty();
 f.hub.captain.stop=async()=>{throw Error('SYNTHETIC child stop failure');};
 await assert.rejects(f.hub.notification({method:'turn/completed',params:{threadId:task.threadId,turn:{id:task.turnId,status:'completed'}}}),/child stop failure/);
 assert.ok(f.hub.dirtyGeneration>f.hub.savedGeneration,'the error added after a successful receipt must remain pending');
 await f.hub.persist(null);assert.match(f.stored.tasks[0].error,/child stop failure/);
});
test('routing edits remain dirty when authority admission rejects before dispatch',async t=>{
 const f=fixture(t,{tasks:[{id:'route',threadId:'synthetic-thread',projectId:'p',crewId:'franky',status:'finished',messages:[]}]});await f.hub.initializeRecovery();
 const task=f.hub.state.tasks[0];f.hub.ensure=async()=>{};f.hub.client.connected=true;f.hub.loaded.add(task.id);f.hub.jevEnabled=()=>true;f.hub.routeEnabled=()=>true;
 f.hub.state.models=[{model:'fixture-model',supportedReasoningEfforts:[{reasoningEffort:'medium'}]}];
 f.hub.jevPrepare=async()=>({status:'ok',journal:'',suggestion:'',activity:''});f.hub.engineeringRoute=async()=>({status:'selected',lane:'MEDIUM',execution:{model:'fixture-model',effort:'medium'},reason:'Synthetic chosen lane'});
 let beforeRoute;const finish=f.hub.finishTurnPreparation.bind(f.hub);f.hub.finishTurnPreparation=(...args)=>{const result=finish(...args);beforeRoute=f.hub.dirtyGeneration;return result;};
 f.hub.prepareDispatch=async()=>{throw Object.assign(Error('synthetic admission full'),{code:'AUTHORITY_SATURATED'});};
 await assert.rejects(f.hub.send(task.id,'Synthetic engineering work'),/admission full/);
 assert.equal(task.model,'fixture-model');assert.equal(task.selectionReason,'Synthetic chosen lane');assert.ok(f.hub.dirtyGeneration>beforeRoute,'routing writes must advance coverage even when no dispatch is admitted');
 await f.hub.persist(null);assert.equal(f.stored.tasks[0].selectionReason,'Synthetic chosen lane');
});
test('reconciliation errors added after awaited failure are not covered by an earlier receipt',async t=>{
 const f=fixture(t,{tasks:[{id:'uncertain',threadId:'synthetic-thread',projectId:'p',crewId:'franky',status:'finished',messages:[]}]});await f.hub.initializeRecovery();
 const task=f.hub.state.tasks[0];f.hub.ensure=async()=>{};f.hub.client.connected=true;f.hub.loaded.add(task.id);f.hub.jevEnabled=()=>false;
 f.hub.client.request=async()=>{throw Object.assign(Error('SYNTHETIC turn uncertain'),{uncertain:true});};
 f.hub.reconcile=async()=>{await f.hub.persist('mission');throw Error('SYNTHETIC status unavailable');};
 await assert.rejects(f.hub.send(task.id,'Synthetic request'),/turn uncertain/);
 assert.ok(f.hub.dirtyGeneration>f.hub.savedGeneration,'appended reconciliation failure must remain pending');
 await f.hub.persist(null);assert.match(f.stored.tasks[0].error,/status unavailable/);
});
