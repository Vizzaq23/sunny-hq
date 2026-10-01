const {receiptStore}=require('./helpers/receipt-store.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Hub}=require('../desktop/hub.cjs');
function fixture(t){
 const saved=[];const hub=new Hub({home:process.cwd(),store:receiptStore({load:()=>({}),save:data=>saved.push(structuredClone(data)),close(){}}),catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 t.after(()=>hub.close());hub.client.connected=true;hub.state.codex.status='connected';
 const task={id:'t',threadId:'thread',projectId:'p',crewId:'franky',status:'unknown',messages:[],updatedAt:1};hub.state.tasks.push(task);hub.gate.acquire(task.id,process.cwd());return {hub,task,saved};
}
test('checking uncertain status preserves running work and never interrupts it',async t=>{
 const {hub,task}=fixture(t),calls=[];
 hub.client.request=async method=>{calls.push(method);return {thread:{status:{type:'active',activeFlags:[]},turns:[{id:'live',status:'inProgress'}]}};};
 assert.equal(typeof hub.checkStatus,'function','a separate non-interrupting recovery action is available');
 await hub.checkStatus(task.id);assert.deepEqual(calls,['thread/read']);assert.equal(task.status,'working');assert.equal(hub.gate.active.has(task.id),true);
});
test('failed status checks keep uncertainty and the project lock visible',async t=>{
 const {hub,task}=fixture(t);hub.client.request=async()=>{throw Error('Offline');};
 assert.equal(typeof hub.checkStatus,'function');await assert.rejects(hub.checkStatus(task.id),/Offline/);assert.equal(task.status,'unknown');assert.match(task.error,/Offline/);assert.equal(hub.gate.active.has(task.id),true);
});
test('streaming batches only changed tasks and preserves the complete reply',async t=>{
 const {hub,task}=fixture(t);task.status='working';const events=[];hub.on('event',e=>events.push(structuredClone(e)));
 for(let i=0;i<100;i++)await hub.notification({method:'item/agentMessage/delta',params:{threadId:'thread',itemId:'reply',delta:'x'}});
 await new Promise(r=>setTimeout(r,90));
 assert.equal(events.filter(e=>e.type==='snapshot').length,0,'streaming does not resend the entire workspace');
 assert.equal(events.filter(e=>e.type==='task').length,1);assert.equal(events[0].data.messages[0].text,'x'.repeat(100));
});
test('approval snapshots supersede pending streamed updates without a stale replay',async t=>{
 const {hub,task}=fixture(t),events=[];task.status='working';hub.on('event',e=>events.push(structuredClone(e)));
 await hub.notification({method:'item/agentMessage/delta',params:{threadId:'thread',itemId:'reply',delta:'Ready'}});
 hub.request({id:1,method:'item/commandExecution/requestApproval',params:{threadId:'thread',turnId:'turn'}});
 assert.equal(events.length,1);assert.equal(events[0].data.tasks[0].status,'waiting');
 await new Promise(r=>setTimeout(r,90));assert.equal(events.length,1);
});
test('continuous streaming checkpoints before the stream ends',async t=>{
 const {hub,saved}=fixture(t);t.mock.timers.enable({apis:['setTimeout']});
 for(let i=0;i<30;i++){await hub.notification({method:'item/agentMessage/delta',params:{threadId:'thread',itemId:'reply',delta:'x'}});t.mock.timers.tick(100);await new Promise(setImmediate);}
 assert.ok(saved.length>=2,'ongoing text must reach disk periodically');assert.ok(saved.at(-1).tasks[0].messages[0].text.length>=20);
});
test('restored uncertain writers reserve their checkout before and after status checks',async t=>{
 const restored={id:'restored',threadId:'thread',projectId:'p',crewId:'franky',status:'working',messages:[]};
 const hub=new Hub({home:process.cwd(),store:receiptStore({load:()=>({projects:[{id:'p',path:process.cwd()}],tasks:[restored]}),save(){},close(){}}),catalog:{discoverTools:()=>[],discoverAutomations:()=>[]}});t.after(()=>hub.close());
 assert.equal(hub.gate.blocked(process.cwd()),true,'unknown restored work reserves its checkout');
 hub.client.connected=true;hub.state.codex.status='connected';hub.client.request=async method=>{if(method==='thread/read')return {thread:{status:{type:'active'},turns:[{id:'live',status:'inProgress'}]}};throw Error('Unexpected provider call '+method);};
 await hub.checkStatus(restored.id);assert.equal(hub.gate.blocked(process.cwd()),true);
 await assert.rejects(hub.start({projectId:'p',crewId:'chopper',prompt:'Overlapping work'}),/already writing/);
});
test('a late active status read cannot overwrite a newer completed turn',async t=>{
 const {hub,task}=fixture(t);task.turnId='live';let finishRead,readStarted;const started=new Promise(r=>readStarted=r);
 hub.client.request=()=>new Promise(r=>{finishRead=r;readStarted();});
 const checking=hub.checkStatus(task.id);await started;
 await hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'live',status:'completed'}}});
 finishRead({thread:{status:{type:'active'},turns:[{id:'live',status:'inProgress'}]}});await checking;
 assert.equal(task.status,'finished');assert.equal(hub.gate.active.has(task.id),false);
});
test('multiple streams flush once per task and completion cancels pending text updates',async t=>{
 const {hub,task}=fixture(t),events=[];hub.state.tasks.push({...task,id:'second',threadId:'thread-two',messages:[]});hub.on('event',e=>events.push(structuredClone(e)));
 for(const threadId of ['thread','thread-two'])for(let i=0;i<10;i++)await hub.notification({method:'item/agentMessage/delta',params:{threadId,itemId:'reply',delta:'x'}});
 await new Promise(r=>setTimeout(r,90));assert.equal(events.length,2);assert.ok(events.every(e=>e.type==='task'&&e.data.messages[0].text==='xxxxxxxxxx'));
 events.length=0;await hub.notification({method:'item/agentMessage/delta',params:{threadId:'thread',itemId:'reply',delta:' end'}});
 await hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{status:'completed'}}});
 assert.equal(events.at(-1).type,'snapshot');assert.equal(events.at(-1).data.tasks[0].status,'finished');const count=events.length;await new Promise(r=>setTimeout(r,90));assert.equal(events.length,count);
});
test('a continuous stream checkpoints by 1000ms in the scheduler',async t=>{
 const {hub,saved}=fixture(t);t.mock.timers.enable({apis:['setTimeout']});
 for(let i=0;i<10;i++){await hub.notification({method:'item/agentMessage/delta',params:{threadId:'thread',itemId:'reply',delta:'x'}});t.mock.timers.tick(100);await new Promise(setImmediate);}
 assert.equal(saved.length,1);assert.equal(saved[0].tasks[0].messages[0].text,'xxxxxxxxxx');
});
test('checking status serializes competing send and stop operations',async t=>{
 const {hub,task}=fixture(t);let finishRead,readStarted;const started=new Promise(r=>readStarted=r);hub.client.request=()=>new Promise(r=>{finishRead=r;readStarted();});
 const checking=hub.checkStatus(task.id);await started;
 await assert.rejects(hub.send(task.id,'Continue'),/in progress/);await assert.rejects(hub.interrupt(task.id),/in progress/);
 finishRead({thread:{status:{type:'idle'},turns:[]}});await checking;assert.equal(hub.taskActions.size,0);
});
test('a disposed renderer cannot prevent scheduling saved state',async t=>{
 const {hub,saved}=fixture(t);t.mock.timers.enable({apis:['setTimeout']});hub.on('event',()=>{throw Error('Render frame was disposed');});
 assert.doesNotThrow(()=>hub.changed());t.mock.timers.tick(250);await new Promise(setImmediate);assert.equal(saved.length,1);
});
test('a disposed companion does not block delivery to the live workspace',()=>{
 const {broadcast}=require('../desktop/broadcast.cjs');const delivered=[];
 const disposed={isDestroyed:()=>false,webContents:{isDestroyed:()=>false,send(){throw Error('Render frame was disposed');}}};
 const live={isDestroyed:()=>false,webContents:{isDestroyed:()=>false,send:(...args)=>delivered.push(args)}};
 assert.doesNotThrow(()=>broadcast([disposed,live],'task',{id:'t'}));assert.deepEqual(delivered,[['sunny:event',{type:'task',data:{id:'t'}}]]);
});
