const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
function fixture(){
 const state={projects:[{id:'p',path:process.cwd()}],tasks:[{id:'t',projectId:'p',status:'working',privateIntent:{secret:'never public'},messages:[{id:'m',role:'assistant',time:1,text:'large '.repeat(500000)}]}],missions:[],approvals:[{id:'a',rpcId:987,taskId:'t',method:'synthetic',params:{question:'Allowed'}}],persistence:{state:'saved',failures:0}};
 let createPublicTransport;try{({createPublicTransport}=require('../desktop/public-transport.cjs'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
 assert.equal(typeof createPublicTransport,'function');const hub=Object.assign(new EventEmitter(),{state});return {state,hub,transport:createPublicTransport(hub,{epoch:'test'})};
}
test('private snapshots and action replies contain summaries without advancing event sequence',()=>{
 const {state,transport}=fixture(),snapshot=transport.snapshot();assert.equal(snapshot.protocolVersion,2);assert.equal(snapshot.sequence,0);assert.equal(snapshot.tasks,undefined);assert.equal(snapshot.approvals[0].rpcId,undefined);assert.ok(JSON.stringify(snapshot).length<10000);
 const reply=transport.taskReply(state.tasks[0]);assert.equal(reply.messages,undefined);assert.equal(reply.privateIntent,undefined);assert.equal(reply.lastAssistantPreview.length,2000);assert.equal(transport.snapshot().sequence,0);
});
test('one published envelope has one shared sequence and private reads cannot create gaps',()=>{
 const {state,transport}=fixture();const event=transport.event('task',state.tasks[0]);assert.equal(event.sequence,1);assert.equal(event.data.messages,undefined);assert.equal(transport.snapshot().sequence,1);
 const approval=transport.event('approval',state.approvals[0]);assert.equal(approval.sequence,2);assert.equal(approval.data.rpcId,undefined);
});
test('actual transcript mutation publishes the same delta revision and event sequence',()=>{
 const {state,transport}=fixture(),task=state.tasks[0],offset=task.messages[0].text.length;task.messages[0].text+='🚀';
 const event=transport.transcriptChanged(task,{kind:'appendText',messageId:'m',offset,text:'🚀'});assert.equal(event.type,'transcript:delta');assert.equal(event.sequence,1);assert.equal(event.data.sequence,1);assert.equal(event.data.kind,'appendText');assert.equal(event.data.revision,2);assert.equal(transport.snapshot().taskSummaries[0].transcriptRevision,2);
});
test('live mutation channels seed new tasks and publish only one envelope to every surface',()=>{
 const {state,hub,transport}=fixture(),first=[],second=[],dispose=transport.bindTranscript(event=>{first.push(event);second.push(event);});
 assert.throws(()=>transport.bindTranscript(()=>{}),/already|bound/i);
 const task={id:'new',projectId:'p',status:'working',messages:[]};state.tasks.push(task);hub.emit('transcript:seed',task);task.messages.push({id:'new-message',role:'assistant',time:1,text:'Actual'});hub.emit('transcript:mutation',task,{kind:'appendMessage',messageId:'new-message'});
 assert.equal(first.length,1);assert.equal(first[0],second[0]);assert.equal(first[0].data.kind,'appendMessage');assert.equal(first[0].sequence,1);assert.equal(transport.snapshot().sequence,1);dispose();assert.equal(hub.listenerCount('transcript:mutation'),0);assert.equal(hub.listenerCount('transcript:seed'),0);
});
test('stale transcript cleanup cannot unbind or permit duplicates after a new binding',()=>{
 const {hub,transport}=fixture(),old=transport.bindTranscript(()=>{});old();const current=transport.bindTranscript(()=>{});old();
 assert.throws(()=>transport.bindTranscript(()=>{}),/already|bound/i);assert.equal(hub.listenerCount('transcript:mutation'),1);current();assert.equal(hub.listenerCount('transcript:mutation'),0);
});
test('pages validate unique membership and stale revisions before returning bounded display',()=>{
 const {state,transport}=fixture(),request={projectId:'p',taskId:'t',epoch:'test',revision:1,direction:'older'};
 const page=transport.page(request);assert.ok(page.segments.reduce((n,s)=>n+Buffer.byteLength(s.text,'utf8'),0)<=256*1024);assert.equal(transport.snapshot().sequence,0);
 assert.throws(()=>transport.page({...request,projectId:'other'}),/project|membership/i);
 assert.equal(transport.page({...request,revision:0}).stale,true);state.tasks.push({...state.tasks[0]});assert.throws(()=>transport.page(request),/unique|ambiguous/i);
});
test('task replies reject a detached or unknown task rather than cloning arbitrary payloads',()=>{
 const {transport}=fixture();assert.throws(()=>transport.taskReply({id:'absent',messages:[]}),/task|registered/i);
});
test('a detached mutation cannot contaminate authoritative transcript metadata',()=>{
 const {state,transport}=fixture(),clone=structuredClone(state.tasks[0]),offset=clone.messages[0].text.length;clone.messages[0].text+='FAKE';
 assert.throws(()=>transport.transcriptChanged(clone,{kind:'appendText',messageId:'m',offset,text:'FAKE'}),/detached|authoritative/i);
 assert.equal(transport.snapshot().sequence,0);assert.equal(transport.snapshot().taskSummaries[0].transcriptRevision,1);assert.ok(!transport.snapshot().taskSummaries[0].lastAssistantPreview.includes('FAKE'));
});
test('uncertain storage withholds result availability while leaving audit in snapshots',async()=>{
 const {state,transport}=fixture();state.persistence={state:'unsaved',failures:1,uncertain:true};state.missions=[{id:'mission',projectId:'p',revision:1,status:'COMPLETE',acceptance:{id:'historical',legacy:false}}];
 const status=await transport.resultStatus({projectId:'p',missionId:'mission',revision:1});assert.equal(status.epoch,'test');assert.equal(status.available,false);assert.match(status.unavailable,/storage|recovery/i);assert.equal(transport.snapshot().missions[0].acceptance.id,'historical');
});
test('an explicit uncertain health state also withholds results',async()=>{
 const {state,transport}=fixture();state.persistence={state:'uncertain',failures:1};state.missions=[{id:'mission',projectId:'p',revision:1,status:'COMPLETE',acceptance:{id:'historical',legacy:false}}];
 const status=await transport.resultStatus({projectId:'p',missionId:'mission',revision:1});assert.equal(status.available,false);assert.match(status.unavailable,/storage|recovery/i);
});
