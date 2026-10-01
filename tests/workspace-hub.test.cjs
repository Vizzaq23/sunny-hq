const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {Hub}=require('../desktop/hub.cjs');
function fixture(t,{saved={},fail=false}={}){
 let value=structuredClone(saved),blocked=fail,writes=0;
 const store={load:()=>structuredClone(value),save(next){writes++;if(blocked)throw Error('Fixture disk unavailable');value=structuredClone(next);},close(){}};
 const hub=new Hub({home:process.cwd(),store,catalog:{discoverProjects:()=>[{id:'p',name:'Fixture',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 const calls=[];hub.client.request=async method=>{calls.push(method);throw Error('Unexpected provider dispatch');};t.after(()=>{blocked=false;hub.close();});
 return {hub,calls,get saved(){return value;},get writes(){return writes;},setBlocked(next){blocked=next;}};
}
const draft={id:'brief-p',kind:'brief',projectId:'p',title:'Preserve context',text:'Keep the captain input',criteria:['Survives restart'],completionBoundary:'review',revision:0,updatedAt:1};
test('Hub saves workspace context and draft atomically and restart never dispatches',t=>{
 const first=fixture(t),context={projectId:'p',surface:'deck',returnTo:{view:'ship',projectId:'p'}};
 const next=first.hub.updateWorkspace({expectedRevision:0,context,draft});
 assert.equal(next.revision,1);assert.equal(next.drafts[0].revision,1);assert.deepEqual(first.saved.missionBook.workspace,next);
 const second=fixture(t,{saved:first.saved});assert.deepEqual(second.hub.state.workspace,next);assert.deepEqual(second.calls,[]);
});
test('failed workspace save rolls back acknowledged state and exposes unsaved health',t=>{
 const f=fixture(t,{fail:true});assert.throws(()=>f.hub.updateWorkspace({expectedRevision:0,draft}),/disk unavailable/);
 assert.deepEqual(f.hub.state.workspace.drafts,[]);assert.equal(f.hub.state.workspace.revision,0);
 assert.equal(f.hub.state.persistence.state,'unsaved');assert.ok(f.hub.state.persistence.failures>=1);assert.deepEqual(f.calls,[]);
});
test('a failed presentation save preserves the mission authority instance used by pending actions',t=>{
 const f=fixture(t,{fail:true}),book=f.hub.missionBook;
 assert.throws(()=>f.hub.updateWorkspace({expectedRevision:0,draft}),/disk unavailable/);
 assert.strictEqual(f.hub.missionBook,book);assert.equal(book.data.workspace.revision,0);
});
test('a stale workspace write and draft clear cannot erase newer captain text',t=>{
 const f=fixture(t);f.hub.updateWorkspace({expectedRevision:0,draft});
 f.hub.updateWorkspace({expectedRevision:1,draft:{...draft,text:'Newer captain input',revision:1}});
 assert.throws(()=>f.hub.updateWorkspace({expectedRevision:1,deleteDraft:{id:draft.id,expectedDraftRevision:1}}),/changed|revision|conflict/i);
 assert.equal(f.hub.state.workspace.drafts[0].text,'Newer captain input');assert.equal(f.hub.state.workspace.drafts[0].revision,2);
});
test('a failing persistence observer cannot roll back a successfully saved draft',t=>{
 const f=fixture(t,{fail:true});assert.throws(()=>f.hub.updateWorkspace({expectedRevision:0,draft}),/disk unavailable/);f.setBlocked(false);
 f.hub.on('event',event=>{if(event.type==='persistence')throw Error('Fixture disposed surface');});
 assert.doesNotThrow(()=>f.hub.updateWorkspace({expectedRevision:0,draft}));
 assert.equal(f.hub.state.workspace.drafts[0].text,draft.text);assert.deepEqual(f.hub.state.workspace,f.saved.missionBook.workspace);
});
test('retry success broadcasts saved health without provider execution',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture(t,{fail:true}),events=[];f.hub.on('event',event=>events.push(structuredClone(event)));
 f.hub.changed();t.mock.timers.tick(250);assert.equal(f.hub.state.persistence.state,'unsaved');const failedAt=events.length;f.setBlocked(false);t.mock.timers.tick(1000);
 assert.equal(f.hub.state.persistence.state,'saved');assert.equal(f.hub.state.persistence.failures,0);
 assert.ok(events.slice(failedAt).some(event=>event.type==='snapshot'&&event.data.persistence?.state==='saved'));assert.deepEqual(f.calls,[]);
});
test('an acceptance cue is durably claimed once across surfaces and restart',t=>{
 const f=fixture(t),hub=f.hub,mission=hub.createMission({projectId:'p',title:'Synthetic cue fixture',objective:'Only test receipt ownership',acceptanceCriteria:['Synthetic receipt'],completionBoundary:'review'});
 const attempt=hub.missionBook.begin(mission.id,mission.revision),text='Fixture result',sha256=createHash('sha256').update(text).digest('hex');
 hub.state.tasks.push({id:attempt.taskId,projectId:'p',crewId:'franky',status:'finished',messages:[{id:'result-message',role:'assistant',text}]});hub.missionBook.sync(hub.state.tasks,[]);
 mission.selectedResult={id:'selected-result',attemptId:attempt.id,producerTaskId:attempt.taskId,ref:{kind:'reply',taskId:attempt.taskId,messageId:'result-message',sha256},selectedAt:1};
 mission.status='COMPLETE';mission.acceptedAt=2;mission.acceptance={id:'acceptance-receipt',actor:'captain',attemptId:attempt.id,reviewedRevision:mission.revision,resultId:'selected-result',resultSha256:sha256,criteria:[true],acceptedAt:2};hub.persist();
 assert.deepEqual(hub.claimAcceptanceCue({acceptanceId:'acceptance-receipt'}),{play:true});assert.deepEqual(hub.claimAcceptanceCue({acceptanceId:'acceptance-receipt'}),{play:false});
 const restarted=fixture(t,{saved:f.saved});assert.deepEqual(restarted.hub.claimAcceptanceCue({acceptanceId:'acceptance-receipt'}),{play:false});assert.deepEqual(restarted.calls,[]);
});
