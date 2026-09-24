const {test}=require('node:test');const assert=require('node:assert/strict');const {Hub}=require('../desktop/hub.cjs');
function fixture(t,{prepare,route}={}){
 let release,entered;const enteredPromise=new Promise(r=>entered=r),held=new Promise(r=>release=r);
 const calls=[];const hub=new Hub({home:process.cwd(),store:{load:()=>({}),save:()=>{},close:()=>{}},catalog:{discoverProjects:()=>[{id:'p',path:process.cwd(),name:'Fixture'}],discoverTools:()=>[],discoverAutomations:()=>[]},jevPrepare:async args=>{entered(args);return prepare?prepare(args):held;},...(route?{engineeringRoute:route}:{})});
 hub.client.connected=true;hub.state.codex.status='connected';hub.client.request=async(method,params)=>{calls.push({method,params});if(method==='thread/start')return {thread:{id:'new-thread'}};if(method==='turn/start')return {turn:{id:'new-turn'}};if(method==='turn/interrupt')return {};throw Error('unexpected '+method);};
 const task={id:'t',threadId:'thread',projectId:'p',crewId:'franky',status:'finished',messages:[],updatedAt:1};hub.state.tasks.push(task);hub.loaded.add(task.id);t.after(()=>{if(!hub.closed)hub.close();});
 return {hub,task,calls,release:()=>release({status:'ok',journal:'Fictional selected context',suggestion:'',activity:'Jev fixture',revision:'1'}),enteredPromise};
}
async function entered(f,sending){return Promise.race([f.enteredPromise,sending.then(()=>{throw Error('preparation not called');})]);}
test('stop during preparation prevents turn/start and releases only its lock',async t=>{const f=fixture(t),sending=f.hub.send('t','Fictional objective');await entered(f,sending);assert.equal(f.task.status,'starting');await f.hub.interrupt('t');f.release();await sending;assert.equal(f.calls.length,0);assert.equal(f.task.status,'interrupted');assert.equal(f.hub.gate.active.has('t'),false);});
test('abort finishes even if preparation ignores its signal',async t=>{const f=fixture(t),sending=f.hub.send('t','Fictional objective');await entered(f,sending);await f.hub.interrupt('t');await sending;assert.equal(f.task.status,'interrupted');assert.equal(f.calls.length,0);f.release();});
test('disconnect during preparation preserves uncertain reservation',async t=>{const f=fixture(t),sending=f.hub.send('t','Fictional objective');await entered(f,sending);f.hub.client.connected=false;f.hub.client.emit('disconnected','fixture');f.release();await sending;assert.equal(f.task.status,'unknown');assert.equal(f.hub.gate.active.has('t'),true);assert.equal(f.calls.length,0);});
test('close during preparation never launches',async t=>{const f=fixture(t),sending=f.hub.send('t','Fictional objective');await entered(f,sending);f.hub.close();f.release();await sending;assert.equal(f.calls.length,0);});
test('revision change prevents stale launch and holds uncertain reservation',async t=>{const f=fixture(t),sending=f.hub.send('t','Fictional objective');await entered(f,sending);f.hub.bumpTask(f.task);f.release();await sending;assert.equal(f.calls.length,0);assert.equal(f.task.status,'unknown');assert.equal(f.hub.gate.active.has('t'),true);});
test('two simultaneous sends cannot prepare or submit twice',async t=>{const f=fixture(t),sending=f.hub.send('t','Original objective');await entered(f,sending);await assert.rejects(f.hub.send('t','Duplicate'),/in progress/);f.release();await sending;assert.equal(f.calls.filter(c=>c.method==='turn/start').length,1);});
test('successful preparation preserves prompt and reports activity',async t=>{const f=fixture(t),sending=f.hub.send('t','Exact objective\nSecond line');await entered(f,sending);f.release();await sending;const text=f.calls[0].params.input[0].text;assert.ok(text.endsWith('Exact objective\nSecond line'));assert.match(text,/Fictional selected context/);assert.equal(f.task.messages.find(m=>m.role==='user').text,'Exact objective\nSecond line');assert.ok(f.task.messages.some(m=>m.role==='system'&&m.text==='Jev fixture'));assert.equal(f.task.status,'working');});
test('service exception falls back without losing the objective',async t=>{const f=fixture(t,{prepare:async()=>{throw Error('PRIVATE_PROVIDER_ERROR');}});f.hub.growth.note('franky','Pinned preference');await f.hub.send('t','Original objective');assert.match(f.calls[0].params.input[0].text,/Pinned preference/);assert.doesNotMatch(JSON.stringify(f.task),/PRIVATE_PROVIDER_ERROR/);assert.equal(f.calls.length,1);});
test('new task cancelled during preparation is interrupted, not failed',async t=>{const f=fixture(t),starting=f.hub.start({projectId:'p',crewId:'franky',prompt:'New objective'});const args=await entered(f,starting);await f.hub.interrupt(args.task.id);f.release();const task=await starting;assert.equal(task.status,'interrupted');assert.equal(f.calls.filter(c=>c.method==='turn/start').length,0);});
test('submitted uncertain turn is not retried and retains reservation',async t=>{const f=fixture(t);const original=f.hub.client.request;f.hub.client.request=async(method,params)=>{if(method==='turn/start'){f.calls.push({method,params});throw Object.assign(Error('uncertain'),{uncertain:true});}if(method==='thread/read')throw Error('disconnected');return original(method,params);};const sending=f.hub.send('t','objective');await entered(f,sending);f.release();await assert.rejects(sending,/uncertain/);assert.equal(f.calls.filter(c=>c.method==='turn/start').length,1);assert.equal(f.task.status,'unknown');assert.equal(f.hub.gate.active.has('t'),true);});
test('project removal prevents pre-turn launch',async t=>{const f=fixture(t),sending=f.hub.send('t','objective');await entered(f,sending);f.hub.state.projects=[];f.release();await sending;assert.equal(f.calls.length,0);assert.equal(f.task.status,'unknown');});
test('Jev lane changes the actual provider turn before engineering work starts',async t=>{
 const f=fixture(t,{prepare:async()=>({status:'disabled',journal:'',suggestion:'',activity:''}),route:async()=>({status:'selected',lane:'MEDIUM',execution:{model:'gpt-6-luna',effort:'medium'},reason:'Jev selected MEDIUM coding lane.'})});
 f.hub.state.models=[{model:'gpt-6-luna',supportedReasoningEfforts:[{reasoningEffort:'medium'}]}];
 await f.hub.send('t','Build a fixture');
 const turn=f.calls.find(c=>c.method==='turn/start').params;
 assert.equal(turn.model,'gpt-6-luna');assert.equal(turn.effort,'medium');
 assert.match(f.task.selectionReason,/MEDIUM/);
 assert.match(turn.input[0].text,/inspect the actual repository diff/i);
});
test('explicit model selection survives Jev lane advice',async t=>{
 const f=fixture(t,{prepare:async()=>({status:'disabled',journal:'',suggestion:'',activity:''}),route:async()=>({status:'selected',lane:'HIGH',execution:{model:'gpt-6-luna',effort:'high'}})});
 f.task.model='gpt-6-sol';f.task.effort='low';f.task.explicitExecution=true;
 await f.hub.send('t','Review code');
 const turn=f.calls.find(c=>c.method==='turn/start').params;
 assert.equal(turn.model,'gpt-6-sol');assert.equal(turn.effort,'low');
});
test('routing failure preserves already selected journal context',async t=>{
 const f=fixture(t,{prepare:async()=>({status:'ok',journal:'Selected fixture evidence',suggestion:'',activity:'Jev context prepared.'}),route:async()=>{throw Error('PRIVATE_ROUTER_ERROR');}});
 await f.hub.send('t','Build a fixture');
 const prompt=f.calls.find(c=>c.method==='turn/start').params.input[0].text;
 assert.match(prompt,/Selected fixture evidence/);
 assert.doesNotMatch(JSON.stringify(f.task),/PRIVATE_ROUTER_ERROR/);
});
