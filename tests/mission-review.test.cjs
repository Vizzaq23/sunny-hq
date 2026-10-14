const {test}=require('node:test'),assert=require('node:assert/strict');
const {Hub}=require('../desktop/hub.cjs');
function setup(t){
 let saved={projects:[{id:'p',path:process.cwd(),name:'Report fixture'}]};
 const store={load:()=>structuredClone(saved),save:value=>{saved=structuredClone(value);},close(){}};
 const catalog={discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]};
 let hub=new Hub({home:process.cwd(),store,catalog}),sequence=0;const calls=[];
 const connect=()=>{hub.client.connected=true;hub.state.codex.status='connected';hub.client.request=async(method,args)=>{calls.push({method,args});if(method==='thread/start')return {thread:{id:'thread-'+(++sequence)}};if(method==='turn/start')return {turn:{id:'turn-'+sequence}};return {};};};connect();
 t.after(()=>hub.close());return {get hub(){return hub;},store,calls,async ready(){const mission=hub.createMission({projectId:'p',title:'Project report',objective:'Write a status report',acceptanceCriteria:['Facts match the source'],completionBoundary:'review'});const task=await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'researcher'});hub.notification({method:'item/completed',params:{threadId:task.threadId,item:{id:'report',type:'agentMessage',text:'Report ready'}}});hub.notification({method:'turn/completed',params:{threadId:task.threadId,turn:{id:task.turnId,status:'completed'}}});return mission;},restart(){hub.close();hub=new Hub({home:process.cwd(),store,catalog});connect();}};
}
test('requested changes bind the reviewed attempt, survive restart and guide a distinct attempt',async t=>{
 const f=setup(t),mission=await f.ready(),revision=mission.revision,attemptId=mission.activeAttemptId;
 f.hub.requestMissionChanges({missionId:mission.id,revision,note:'Include the blocked payment setup.'});
 assert.equal(mission.status,'BLOCKED');assert.equal(mission.reviewDecisions[0].attemptId,attemptId);assert.equal(mission.reviewDecisions[0].reviewedRevision,revision);
 await assert.rejects(f.hub.acceptMission({missionId:mission.id,revision,criteria:[true]}),/changed/);
 f.restart();const restored=f.hub.missionBook.get(mission.id);assert.equal(restored.status,'BLOCKED');assert.equal(restored.reviewDecisions[0].note,'Include the blocked payment setup.');
 await f.hub.startMission({missionId:restored.id,revision:restored.revision,roleId:'researcher'});
 assert.notEqual(restored.activeAttemptId,attemptId);assert.equal(restored.reviewDecisions.length,1);assert.match(f.calls.findLast(call=>call.method==='turn/start').args.input[0].text,/Include the blocked payment setup/);
});
test('empty changes and unresolved side effects cannot create a review decision',async t=>{
 const f=setup(t),mission=await f.ready(),command={missionId:mission.id,revision:mission.revision,note:'Fix facts'};
 assert.throws(()=>f.hub.requestMissionChanges({...command,note:' '}),/note|changes/i);
 for(const field of ['checkExecution','prPublication','mergeRequest']){const current=f.hub.missionBook.get(mission.id);current[field]=field==='checkExecution'?{id:'pending',script:'test',startedAt:1,attemptId:current.activeAttemptId}:{state:field==='mergeRequest'?'uncertain':'publishing'};assert.throws(()=>f.hub.requestMissionChanges(command),/resolve|reconcile|pending/i);delete f.hub.missionBook.get(mission.id)[field];}
 assert.equal(f.hub.missionBook.get(mission.id).reviewDecisions,undefined);
});
test('review checkpoint failure rolls back status and decision without launching work',async t=>{
 const f=setup(t),mission=await f.ready(),original=f.store.save,calls=f.calls.length;f.store.save=()=>{throw Error('Disk full');};
 assert.throws(()=>f.hub.requestMissionChanges({missionId:mission.id,revision:mission.revision,note:'Fix facts'}),/Disk full/);
 assert.equal(f.hub.missionBook.get(mission.id).status,'WAITING_FOR_REVIEW');assert.equal(f.hub.missionBook.get(mission.id).reviewDecisions,undefined);assert.equal(f.calls.length,calls);f.store.save=original;
});
test('acceptance records the captain decision only after criteria, and persists after restart',async t=>{
 const f=setup(t),mission=await f.ready();await assert.rejects(f.hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[false]}),/criteria/);
 const current=f.hub.missionBook.get(mission.id);await f.hub.acceptMission({missionId:current.id,revision:current.revision,criteria:[true]});
 f.restart();const restored=f.hub.missionBook.get(mission.id);assert.equal(restored.status,'COMPLETE');assert.equal(restored.reviewDecisions.at(-1).decision,'accepted');assert.equal(restored.reviewDecisions.at(-1).actor,'captain');assert.equal(restored.acceptance.attemptId,restored.activeAttemptId);
});
