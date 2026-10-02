const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Hub}=require('../desktop/hub.cjs');
const {receiptStore}=require('./helpers/receipt-store.cjs');
const {createPublicTransport}=require('../desktop/public-transport.cjs');
async function fixture(t){
 let saved={projects:[{id:'p',path:process.cwd()}],tasks:[{id:'t',projectId:'p',crewId:'franky',threadId:'th',turnId:'turn',status:'finished',messages:[]}]};
 const store=receiptStore({load:()=>structuredClone(saved),save:image=>{saved=structuredClone(image);},close:()=>{}});
 const hub=new Hub({home:process.cwd(),store,catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]}});await hub.initializeRecovery();
 hub.ensure=async()=>{};hub.client.connected=true;hub.state.codex.status='connected';hub.client.request=async method=>method==='thread/start'?{thread:{id:'new-thread'}}:method==='turn/start'?{turn:{id:'new-turn'}}:{};
 const transport=createPublicTransport(hub,{epoch:'integration'}),events=[];transport.bindTranscript(event=>events.push(event));hub.on('event',event=>events.push(transport.event(event.type,event.data)));
 t.after(()=>hub.close());return {hub,transport,events,task:hub.task('t')};
}
test('real provider append and completed replacement advance public revisions without full task payloads',async t=>{
 const {hub,transport,events,task}=await fixture(t);task.status='working';
 await hub.notification({method:'item/agentMessage/delta',params:{threadId:'th',itemId:'message',delta:'Actual'}});
 const deltas=events.filter(event=>event.type==='transcript:delta');assert.equal(deltas.length,2);assert.equal(deltas[0].data.kind,'appendMessage');assert.equal(deltas[1].data.kind,'appendText');assert.equal(deltas[1].data.offset,0);assert.equal(deltas[1].data.text,'Actual');
 await hub.notification({method:'item/completed',params:{threadId:'th',item:{id:'message',type:'agentMessage',text:'Replacement'}}});
 assert.equal(events.filter(event=>event.type==='transcript:delta').at(-1).data.kind,'invalidate');const snapshot=transport.snapshot();assert.equal(snapshot.taskSummaries[0].transcriptRevision,4);assert.equal(snapshot.taskSummaries[0].lastAssistantPreview,'Replacement');assert.equal(snapshot.tasks,undefined);
 assert.equal(task.messages[0].text,'Replacement');assert.ok(events.every(event=>event.type!=='task'||event.data.messages===undefined));
});
test('real Captain logs publish append metadata before their public snapshot',async t=>{
 const {hub,events,task}=await fixture(t);hub.captain.log(task,'Synthetic log text');
 const delta=events.find(event=>event.type==='transcript:delta');assert.ok(delta);assert.equal(delta.data.kind,'appendMessage');assert.equal(delta.data.role,'system');assert.equal(delta.data.text,'Synthetic log text');
});
test('new task is seeded empty before its first admitted user message',async t=>{
 const {hub,events}=await fixture(t);const task=await hub.start({projectId:'p',crewId:'franky',prompt:'Synthetic prompt'});
 const delta=events.find(event=>event.type==='transcript:delta'&&event.data.taskId===task.id);assert.ok(delta);assert.equal(delta.data.kind,'appendMessage');assert.equal(delta.data.baseRevision,1);assert.equal(delta.data.role,'user');assert.equal(delta.data.text,'Synthetic prompt');
});
