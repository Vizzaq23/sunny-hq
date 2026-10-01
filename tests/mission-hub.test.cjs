const {test}=require('node:test');const assert=require('node:assert/strict');const {Hub}=require('../desktop/hub.cjs');
function setup(t,initial={}){
 const saves=[];const store={load:()=>initial,save:data=>saves.push(structuredClone(data)),close:()=>{}};
 const hub=new Hub({home:process.cwd(),store,catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 t.after(()=>hub.close());hub.client.connected=true;hub.state.codex.status='connected';
 hub.client.request=async method=>method==='thread/start'?{thread:{id:'thread'}}:method==='turn/start'?{turn:{id:'turn'}}:{};
 return {hub,store,saves};
}
const brief={projectId:'p',title:'Inventory',objective:'Track items',acceptanceCriteria:['Saved items reload'],completionBoundary:'review'};
const resultHash=text=>require('node:crypto').createHash('sha256').update(text,'utf8').digest('hex');
async function finishedReply(hub,mission){
 const task=await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});
 hub.notification({method:'item/completed',params:{threadId:task.threadId,item:{type:'agentMessage',id:'result-'+task.id,text:'Implemented saved-item reload; review the fixture result.'}}});
 hub.notification({method:'turn/completed',params:{threadId:task.threadId,turn:{id:task.turnId,status:'completed'}}});return task;
}
async function selectReply(hub,mission,task){const message=task.messages.find(m=>m.role==='assistant');return hub.selectMissionResult({missionId:mission.id,revision:mission.revision,ref:{kind:'reply',taskId:task.id,messageId:message.id,sha256:resultHash(message.text)}});}
function acceptanceInput(mission){return {missionId:mission.id,revision:mission.revision,resultId:mission.selectedResult?.id,resultSha256:mission.selectedResult?.ref.sha256,criteria:[true]};}
function recordFixtureReply(hub,mission){const task=hub.task(mission.attempts.at(-1).taskId);hub.notification({method:'item/completed',params:{threadId:task.threadId,item:{type:'agentMessage',id:'fixture-result-'+task.id,text:'Fixture output: saved inventory persists after reload.'}}});return task;}
async function selectFixtureReply(hub,mission){return selectReply(hub,mission,recordFixtureReply(hub,mission));}
async function selectDeliverable(hub,mission,artifact){return hub.selectMissionResult({missionId:mission.id,revision:mission.revision,producerTaskId:mission.attempts.at(-1).taskId,ref:{kind:'deliverable',artifactId:artifact.id,sha256:artifact.sha256}});}

test('selected reply acceptance persists matching receipt identity and does not publish',async t=>{
 const {hub,saves}=setup(t),mission=hub.createMission(brief),task=await finishedReply(hub,mission);await selectReply(hub,mission,task);
 const selectedId=mission.selectedResult.id;await hub.acceptMission(acceptanceInput(mission));
 assert.equal(mission.acceptance.resultId,selectedId);assert.equal(mission.acceptance.resultSha256,mission.selectedResult.ref.sha256);assert.ok(mission.acceptance.id);assert.equal(mission.acceptance.acceptedAt,mission.acceptedAt);assert.equal(mission.acceptance.reviewedRevision,mission.revision-1);
 assert.equal(saves.at(-1).missionBook.missions[0].status,'COMPLETE');assert.equal(mission.prPublication,undefined);assert.equal(new (require('../desktop/missions.cjs').MissionBook)(saves.at(-1).missionBook).get(mission.id).acceptance.id,mission.acceptance.id);
 await assert.rejects(hub.acceptMission(acceptanceInput(mission)),/not ready/i);
 const receipt=structuredClone(mission.acceptance),result=structuredClone(mission.selectedResult);await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'}),/running|active|complete/i);assert.deepEqual(hub.missionBook.get(mission.id).acceptance,receipt);assert.deepEqual(hub.missionBook.get(mission.id).selectedResult,result);
});
test('acceptance_save_failure_rolls_back',async t=>{
 const {hub,store}=setup(t),mission=hub.createMission(brief),task=await finishedReply(hub,mission);await selectReply(hub,mission,task);const command=acceptanceInput(mission),events=[];hub.on('event',event=>events.push(structuredClone(event)));store.save=()=>{throw Error('Disk full');};
 await assert.rejects(hub.acceptMission(command),/Disk full/);const saved=hub.missionBook.get(mission.id);assert.equal(saved.status,'WAITING_FOR_REVIEW');assert.equal(saved.acceptance,undefined);assert.equal(saved.acceptedAt,undefined);assert.equal(saved.events.some(e=>e.type==='MISSION_COMPLETE'),false);assert.equal(events.some(e=>e.data?.missions?.some(m=>m.status==='COMPLETE')),false);assert.equal(saved.selectedResult.id,command.resultId);store.save=()=>{};
});
test('unattached_result_cannot_accept even when every criterion is confirmed',async t=>{
 const {hub}=setup(t),mission=hub.createMission(brief);await finishedReply(hub,mission);await assert.rejects(hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]}),/result|selected/i);assert.equal(mission.status,'WAITING_FOR_REVIEW');
});
test('changed selected reply cannot accept and forged identity cannot replace selection',async t=>{
 const {hub}=setup(t),mission=hub.createMission(brief),task=await finishedReply(hub,mission);await selectReply(hub,mission,task);const command=acceptanceInput(mission);
 await assert.rejects(hub.acceptMission({...command,resultId:'forged'}),/selected|result/i);await assert.rejects(hub.acceptMission({...command,resultSha256:'f'.repeat(64)}),/selected|result/i);
 task.messages.find(m=>m.role==='assistant').text+=' Changed';await assert.rejects(hub.acceptMission(command),/changed|hash/i);assert.equal(mission.status,'WAITING_FOR_REVIEW');
});
test('rework_prompt_persists_on_new_attempt_before_dispatch',async t=>{
 const {hub,saves}=setup(t),mission=hub.createMission(brief),task=await finishedReply(hub,mission);await selectReply(hub,mission,task);const previousAttempt=mission.attempts.at(-1),artifacts=structuredClone(mission.artifacts),requestedChanges='Keep the saved items after reload';let prompt;
 hub.client.request=async(method,params)=>{if(method==='thread/start'){assert.equal(saves.at(-1).missionBook.missions[0].attempts.at(-1).requestedChanges,requestedChanges);return {thread:{id:'rework'}};}if(method==='turn/start'){prompt=params.input[0].text;return {turn:{id:'rework-turn'}};}return {};};
 await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder',requestedChanges});assert.notEqual(mission.activeAttemptId,previousAttempt.id);assert.equal(mission.attempts.at(-1).requestedChanges,requestedChanges);assert.equal(mission.selectedResult,undefined);assert.equal(mission.objective,brief.objective);assert.deepEqual(mission.acceptanceCriteria,brief.acceptanceCriteria);assert.deepEqual(mission.artifacts,artifacts);assert.ok(prompt.includes(requestedChanges));assert.match(prompt,/captain.*changes/i);
});
test('rework reacquires authoritative mission after rollback during async preparation',async t=>{
 const {hub,store,saves}=setup(t),mission=hub.createMission(brief);await finishedReply(hub,mission);const priorAttemptId=mission.activeAttemptId,requestedChanges='CRITICAL CAPTAIN REWORK',originalEnsure=hub.ensure.bind(hub);let finishPreparation,pause=true,prompt;
 hub.ensure=()=>pause?new Promise(resolve=>{finishPreparation=()=>{pause=false;resolve();};}):originalEnsure();
 hub.client.request=async(method,params)=>{if(method==='thread/start')return {thread:{id:'rework-thread'}};if(method==='turn/start'){prompt=params.input[0].text;return {turn:{id:'rework-turn'}};}return {};};
 const pending=hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder',requestedChanges});
 store.save=()=>{throw Error('Concurrent disk full');};assert.throws(()=>hub.markMissionSignalSeen({missionId:mission.id,revision:mission.revision,eventId:mission.events[0].id}),/Concurrent disk full/);store.save=data=>saves.push(structuredClone(data));
 const current=hub.missionBook.get(mission.id);assert.notEqual(current,mission);finishPreparation();const task=await pending,attempt=current.attempts.at(-1),saved=saves.at(-1).missionBook.missions[0];
 assert.notEqual(attempt.id,priorAttemptId);assert.equal(task.id,attempt.taskId);assert.equal(saved.attempts.at(-1).requestedChanges,requestedChanges);assert.ok(prompt.includes(requestedChanges),'provider prompt must include the exact saved rework text');assert.ok(prompt.includes(brief.objective));assert.equal(saved.events.filter(event=>event.type==='ROUTING_DECIDED').length,2);assert.equal(saved.events.at(-1).attemptId,attempt.id);
});
test('revision changes during async rework preparation still prevent provider dispatch',async t=>{
 const {hub}=setup(t),mission=hub.createMission(brief);await finishedReply(hub,mission);let finishPreparation,calls=0;hub.ensure=()=>new Promise(resolve=>{finishPreparation=resolve;});hub.client.request=async()=>{calls++;throw Error('Unexpected provider dispatch');};
 const pending=hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder',requestedChanges:'Keep saved items'});hub.markMissionSignalSeen({missionId:mission.id,revision:mission.revision,eventId:mission.events[0].id});finishPreparation();await assert.rejects(pending,/changed/i);assert.equal(calls,0);const current=hub.missionBook.get(mission.id);assert.equal(current.status,'WAITING_FOR_REVIEW');assert.equal(current.attempts.length,1);assert.equal(current.events.filter(event=>event.type==='ROUTING_DECIDED').length,1);
});
test('rework rejects invalid phase, stale revision and invalid bounded changes',async t=>{
 const {hub}=setup(t),mission=hub.createMission(brief);await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder',requestedChanges:'Change'}),/review|rework/i);assert.equal(mission.attempts.length,0);await finishedReply(hub,mission);
 for(const requestedChanges of ['', ' ', 'x'.repeat(50001),42,'bad\0change'])await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder',requestedChanges}),/changes|rework/i);
 await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision-1,roleId:'builder',requestedChanges:'Change'}),/changed/i);assert.equal(mission.attempts.length,1);
});
test('selection and acceptance reject stale async reads and keep concurrent actions locked',async t=>{
 const {hub}=setup(t),mission=hub.createMission(brief),task=await finishedReply(hub,mission);await selectReply(hub,mission,task);
 mission.artifacts.push({id:'check',kind:'check',attemptId:mission.activeAttemptId,status:'passed',script:'test',fingerprint:'source'});let finish;hub.evidence.gitState=()=>new Promise(resolve=>{finish=resolve;});const command=acceptanceInput(mission),pending=hub.acceptMission(command);
 assert.equal(hub.gate.blocked(process.cwd()),true);await assert.rejects(selectReply(hub,mission,task),/current mission action/i);await assert.rejects(hub.acceptMission(command),/check|evidence/i);hub.missionBook.record(mission,'EXTERNAL_FIXTURE_CHANGE');finish({fingerprint:'source'});await assert.rejects(pending,/changed/i);assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.equal(mission.acceptance,undefined);assert.equal(hub.gate.blocked(process.cwd()),false);
});
test('result selection save failure and stale artifact read keep prior selection',async t=>{
 const {hub,store}=setup(t),mission=hub.createMission(brief),task=await finishedReply(hub,mission);await selectReply(hub,mission,task);const selected=structuredClone(mission.selectedResult);
 store.save=()=>{throw Error('Selection disk full');};await assert.rejects(selectReply(hub,mission,task),/disk full/);store.save=()=>{};const current=hub.missionBook.get(mission.id);assert.deepEqual(current.selectedResult,selected);
 current.artifacts.push({id:'file',kind:'deliverable',projectId:'p',attemptId:current.activeAttemptId,filePath:'fixture.md',sha256:resultHash('fixture')});let finish;hub.readMissionResultArtifact=()=>new Promise(resolve=>{finish=resolve;});const pending=selectDeliverable(hub,current,current.artifacts.at(-1));assert.equal(hub.gate.blocked(process.cwd()),true);hub.missionBook.record(current,'EXTERNAL_FIXTURE_CHANGE');finish({sha256:resultHash('fixture')});await assert.rejects(pending,/changed/i);assert.deepEqual(current.selectedResult,selected);assert.equal(hub.gate.active.size,0);
});
test('reply changed between resolution and durable selection is rejected',async t=>{
 const {hub}=setup(t),mission=hub.createMission(brief),task=await finishedReply(hub,mission),pending=selectReply(hub,mission,task);task.messages.find(m=>m.role==='assistant').text+=' Changed before save';await assert.rejects(pending,/changed/i);assert.equal(hub.missionBook.get(mission.id).selectedResult,undefined);
});
test('acceptance takes a detached intent snapshot across asynchronous verification',async t=>{
 const {hub}=setup(t),mission=hub.createMission(brief),task=await finishedReply(hub,mission);await selectReply(hub,mission,task);mission.artifacts.push({id:'check',kind:'check',attemptId:mission.activeAttemptId,status:'passed',script:'test',fingerprint:'source'});let finish;hub.evidence.gitState=()=>new Promise(resolve=>{finish=resolve;});const command=acceptanceInput(mission),pending=hub.acceptMission(command);command.criteria[0]=false;command.resultId='mutated';finish({fingerprint:'source'});await pending;assert.deepEqual(mission.acceptance.criteria,[true]);assert.equal(mission.acceptance.resultId,mission.selectedResult.id);
});
test('result commands cannot smuggle provider authority or release an uncertain writer',async t=>{
 const {hub}=setup(t),mission=hub.createMission(brief),task=await finishedReply(hub,mission);await selectReply(hub,mission,task);const message=task.messages.find(m=>m.role==='assistant');
 await assert.rejects(hub.selectMissionResult({missionId:mission.id,revision:mission.revision,ref:{kind:'reply',taskId:task.id,messageId:message.id,sha256:resultHash(message.text)},provider:'injected'}),/Invalid/);await assert.rejects(hub.acceptMission({...acceptanceInput(mission),approved:true}),/Invalid/);
 const uncertain={id:'uncertain',projectId:'p',status:'unknown'};hub.reserveWriter(uncertain);await assert.rejects(hub.acceptMission(acceptanceInput(mission)),/checkout|already writing/i);assert.equal(hub.gate.active.has(uncertain.id),true);assert.equal(mission.acceptance,undefined);
});
test('a historical result cannot authorize a later rework attempt',async t=>{
 const {hub}=setup(t),mission=hub.createMission(brief),task=await finishedReply(hub,mission);await selectReply(hub,mission,task);const old=acceptanceInput(mission),oldResult=structuredClone(mission.selectedResult),oldArtifacts=structuredClone(mission.artifacts);
 await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder',requestedChanges:' Preserve all saved items. '});const nextTask=hub.task(mission.attempts.at(-1).taskId);nextTask.status='finished';hub.gate.release(nextTask.id);hub.changed();
 await assert.rejects(hub.acceptMission({...old,revision:mission.revision}),/result|selected/i);await assert.rejects(hub.selectMissionResult({missionId:mission.id,revision:mission.revision,ref:oldResult.ref}),/attempt|member/i);assert.deepEqual(mission.artifacts,oldArtifacts);assert.equal(mission.attempts.at(-1).requestedChanges,' Preserve all saved items. ');assert.equal(mission.status,'WAITING_FOR_REVIEW');
});

test('missing-thread recovery persists interruption before release and rolls back failed saves',async t=>{
 const {hub,store,saves}=setup(t,{tasks:[{id:'legacy',projectId:'p',crewId:'franky',status:'starting',updatedAt:10,messages:[]}]});
 const command={taskId:'legacy',expectedUpdatedAt:10,confirmedStopped:true};
 await assert.rejects(hub.resolveMissingThread({...command,confirmedStopped:false}),/confirm/i);await assert.rejects(hub.resolveMissingThread({...command,expectedUpdatedAt:9}),/changed/i);
 store.save=()=>{throw Error('Disk full');};await assert.rejects(hub.resolveMissingThread(command),/Disk full/);assert.equal(hub.task('legacy').status,'unknown');assert.equal(hub.gate.blocked(process.cwd()),true);
 store.save=data=>{assert.equal(hub.gate.blocked(process.cwd()),true);saves.push(structuredClone(data));};await hub.resolveMissingThread(command);store.save=()=>{};
 assert.equal(saves.at(-1).tasks[0].status,'interrupted');assert.match(saves.at(-1).tasks[0].messages.at(-1).text,/Captain confirmed/);assert.equal(hub.gate.blocked(process.cwd()),false);
 await assert.rejects(hub.resolveMissingThread(command),/changed|unknown/i);
});

test('missing-thread recovery rejects live launch, known thread, external and active descendants',async t=>{
 const {hub}=setup(t,{tasks:[{id:'legacy',projectId:'p',crewId:'franky',status:'unknown',updatedAt:10,messages:[]}]});const task=hub.task('legacy'),command={taskId:task.id,expectedUpdatedAt:10,confirmedStopped:true};
 task.threadId='known';await assert.rejects(hub.resolveMissingThread(command),/thread|unknown/i);delete task.threadId;
 task.external=true;await assert.rejects(hub.resolveMissingThread(command),/local|external/i);delete task.external;
 hub.launchingTasks.add(task.id);await assert.rejects(hub.resolveMissingThread(command),/launch|pending/i);hub.launchingTasks.delete(task.id);
 hub.state.tasks.push({id:'child',parentTaskId:task.id,status:'unknown',messages:[]});await assert.rejects(hub.resolveMissingThread(command),/assignment|descendant/i);assert.equal(hub.gate.blocked(process.cwd()),true);
});

test('missing-thread confirmation cannot race an outstanding provider launch',async t=>{
 const {hub}=setup(t);let finishThread;hub.client.request=async method=>method==='thread/start'?new Promise(resolve=>{finishThread=resolve;}):{turn:{id:'turn'}};
 const launching=hub.start({projectId:'p',crewId:'franky',prompt:'Launch fixture'});await new Promise(resolve=>setImmediate(resolve));const task=hub.state.tasks[0];task.status='unknown';
 await assert.rejects(hub.resolveMissingThread({taskId:task.id,expectedUpdatedAt:task.updatedAt,confirmedStopped:true}),/pending/);assert.equal(hub.gate.blocked(process.cwd()),true);
 finishThread({thread:{id:'late-thread'}});await launching;assert.equal(task.status,'working');assert.equal(hub.launchingTasks.size,0);assert.equal(hub.gate.blocked(process.cwd()),true);
});

test('missing-thread mission recovery saves cancelled attempt and permits a distinct retry',async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);const attempt=hub.missionBook.begin(mission.id,mission.revision);hub.state.tasks.push({id:attempt.taskId,projectId:'p',crewId:'franky',status:'unknown',updatedAt:10,messages:[]});hub.reserveWriter(hub.task(attempt.taskId));hub.changed();
 await hub.resolveMissingThread({taskId:attempt.taskId,expectedUpdatedAt:10,confirmedStopped:true});assert.equal(mission.status,'CANCELLED');assert.equal(saves.at(-1).missionBook.missions[0].status,'CANCELLED');
 await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});assert.notEqual(mission.activeAttemptId,attempt.id);assert.equal(mission.attempts[0].status,'interrupted');
});

test('uncertain check stays reserved across restart until exact captain confirmation',async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 hub.evidence.runCheck=async()=>{assert.equal(saves.at(-1).missionBook.missions[0].checkExecution.script,'test');throw Object.assign(Error('Cleanup uncertain'),{uncertain:true});};
 await assert.rejects(hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,script:'test'}),/uncertain/);
 const restored=setup(t,saves.at(-1));const m=restored.hub.state.missions[0],marker=m.checkExecution;
 assert.equal(restored.hub.gate.blocked(process.cwd()),true);await assert.rejects(restored.hub.acceptMission({missionId:m.id,revision:m.revision,criteria:[true]}),/check/);
 const command={missionId:m.id,revision:m.revision,executionId:marker.id,confirmedStopped:true};
 assert.throws(()=>restored.hub.reconcileMissionCheck({...command,confirmedStopped:false}),/Confirm/);assert.throws(()=>restored.hub.reconcileMissionCheck({...command,revision:m.revision-1}),/changed/);
 assert.throws(()=>restored.hub.reconcileMissionCheck({...command,executionId:'old'}),/current|changed/);
 restored.store.save=()=>{throw Error('Disk full');};assert.throws(()=>restored.hub.reconcileMissionCheck(command),/Disk full/);assert.equal(restored.hub.gate.blocked(process.cwd()),true);restored.store.save=()=>{};
 restored.hub.reconcileMissionCheck(command);assert.equal(restored.hub.gate.blocked(process.cwd()),false);assert.equal(restored.hub.state.missions[0].checkExecution,undefined);
 assert.equal(restored.hub.state.missions[0].artifacts.at(-1).status,'failed');
 await assert.rejects(restored.hub.acceptMission({missionId:m.id,revision:restored.hub.state.missions[0].revision,criteria:[true]}),/check|passed/);
 restored.hub.evidence.runCheck=async()=>({kind:'check',script:'test',status:'passed',fingerprint:'new-source'});restored.hub.evidence.gitState=async()=>({fingerprint:'new-source'});
 await restored.hub.collectMissionEvidence({missionId:m.id,revision:restored.hub.state.missions[0].revision,script:'test'});await selectFixtureReply(restored.hub,restored.hub.state.missions[0]);await restored.hub.acceptMission(acceptanceInput(restored.hub.state.missions[0]));assert.equal(restored.hub.state.missions[0].status,'COMPLETE');
});

test('pending check cannot be manually cleared and failure to save intent prevents execution',async t=>{
 const {hub,store}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let calls=0,finish;hub.evidence.runCheck=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};store.save=()=>{throw Error('Disk full');};await assert.rejects(hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,script:'test'}),/Disk full/);assert.equal(calls,0);store.save=()=>{};
 const m=hub.state.missions[0],pending=hub.collectMissionEvidence({missionId:m.id,revision:m.revision,script:'test'});
 const reloaded=setup(t,{missionBook:structuredClone(hub.missionBook.data),projects:hub.state.projects,tasks:hub.state.tasks});assert.equal(reloaded.hub.gate.blocked(process.cwd()),true);
 assert.throws(()=>hub.reconcileMissionCheck({missionId:m.id,revision:m.revision,executionId:m.checkExecution.id,confirmedStopped:true}),/running|pending/);
 finish({kind:'check',script:'test',status:'passed',exitCode:0,fingerprint:'source'});await pending;assert.equal(hub.state.missions[0].checkExecution,undefined);assert.equal(hub.gate.blocked(process.cwd()),false);
});

test('failed result checkpoint retains check reservation until durable recovery',async t=>{
 const {hub,store}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 hub.evidence.runCheck=async()=>{store.save=()=>{throw Error('Result disk full');};return {kind:'check',script:'test',status:'passed'};};
 await assert.rejects(hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,script:'test'}),/Result disk full/);assert.ok(hub.state.missions[0].checkExecution);assert.equal(hub.gate.blocked(process.cwd()),true);store.save=()=>{};
});

test('provider turn dispatch requires durable thread and execution identity',async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);
 hub.client.request=async method=>{if(method==='thread/start')return {thread:{id:'durable-thread'}};if(method==='turn/start'){const saved=saves.at(-1).tasks[0];assert.equal(saved.threadId,'durable-thread');assert.ok(saved.executionId);assert.equal(saved.status,'working');return {turn:{id:'turn'}};}return {};};
 await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
});

test('delegated task checkpoint failure prevents all provider requests',async t=>{
 const {hub,store}=setup(t);let calls=0;hub.client.request=async()=>{calls++;return {thread:{id:'thread'},turn:{id:'turn'}};};store.save=()=>{throw Error('Disk unavailable');};
 await assert.rejects(hub.start({projectId:'p',crewId:'franky',prompt:'Scoped assignment'},{parentTaskId:'captain'}),/Disk unavailable/);assert.equal(calls,0);store.save=()=>{};
});

test('unknown legacy launch without a thread retains its checkout reservation',async t=>{
 const {hub}=setup(t,{tasks:[{id:'legacy-start',projectId:'p',crewId:'franky',status:'starting',messages:[]}]});
 assert.equal(hub.state.tasks[0].status,'unknown');assert.equal(hub.gate.blocked(process.cwd()),true);
 await assert.rejects(hub.start({projectId:'p',crewId:'franky',prompt:'Another writer'}),/already|checkout|project/i);
});

test('delayed turn starts cannot resurrect completed work or replace a current turn',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);const task=await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 hub.notification({method:'turn/started',params:{threadId:'thread',turn:{id:'old-turn'}}});assert.equal(task.turnId,'turn');
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 hub.notification({method:'turn/started',params:{threadId:'thread',turn:{id:'turn'}}});
 assert.equal(task.status,'finished');assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.equal(hub.gate.active.has(task.id),false);
});

test('finished coordinated stage cannot be changed while coordinator still runs',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);const attempt=hub.missionBook.begin(mission.id,mission.revision);attempt.workflowVersion=1;
 const child={id:'builder-child',projectId:'p',parentTaskId:attempt.taskId,crewId:'franky',threadId:'builder-thread',turnId:'builder-turn',status:'finished',messages:[]};
 attempt.taskIds.push(child.id);hub.state.tasks.push(child);let calls=0;hub.client.request=async()=>{calls++;return {turn:{id:'another'}};};
 await assert.rejects(hub.send(child.id,'Change the implementation again'),/new attempt|mission board/i);assert.equal(calls,0);
});

test('merge acceptance rejects a PR retargeted since inspection',async t=>{
 const {hub}=setup(t);const mission=hub.createMission({...brief,completionBoundary:'merge'});await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 const evidence={kind:'pull-request',number:1,url:'https://github.com/fixture/sunny/pull/1',commit:'a'.repeat(40),fingerprint:'source',baseBranch:'main',state:'MERGED',mergedAt:'2026-09-21T12:00:00Z',checkStatus:'passed'};
 hub.pullRequests.inspect=async()=>({...evidence});await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,prNumber:1});
 hub.pullRequests.inspect=async()=>({...evidence,baseBranch:'wrong-target'});
 await assert.rejects(hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]}),/changed/i);assert.equal(mission.status,'WAITING_FOR_REVIEW');
});

test('image evidence keeps provenance without image bytes and refuses changed-file preview or acceptance',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-image-hub-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');fs.writeFileSync(path.join(root,'art.png'),png);
 const {hub,saves}=setup(t);hub.state.projects[0].path=root;hub.imageReader=(r,p)=>require('../desktop/image-deliverables.cjs').readImageDeliverable(r,p,()=>({isEmpty:()=>false,getSize:()=>({width:1,height:1}),toPNG:()=>png}));
 const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'brook'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 await assert.rejects(hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,imagePath:'art.png'}),/notes/);
 const a=await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,imagePath:'art.png',provenance:{source:'Fixture',usage:'Test only'}});assert.equal(a.kind,'image');assert.equal(a.dataUrl,undefined);assert.equal(saves.at(-1).missionBook.missions[0].artifacts[0].dataUrl,undefined);assert.equal(a.provenance.source,'Fixture');
 assert.match(hub.previewMissionDeliverable({missionId:mission.id,revision:mission.revision,artifactId:a.id}).dataUrl,/^data:image\/png;base64,/);
 await selectDeliverable(hub,mission,a);
 const changed=Buffer.from(png);changed[45]^=1;fs.writeFileSync(path.join(root,'art.png'),changed);assert.throws(()=>hub.previewMissionDeliverable({missionId:mission.id,revision:mission.revision,artifactId:a.id}),/changed/i);await assert.rejects(hub.acceptMission(acceptanceInput(mission)),/changed/i);assert.equal(mission.status,'WAITING_FOR_REVIEW');
});

test('deployment observations attach to current attempt without granting acceptance and survive reload',async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 hub.deployments.inspect=async()=>({kind:'deployment',commit:'a'.repeat(40),repository:'owner/repo',deployments:[],recordedAt:1});
 await assert.rejects(hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,deployment:true,script:'test'}),/one/i);
 await assert.rejects(hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,deployment:'yes'}),/deployment/i);
 const artifact=await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,deployment:true});assert.equal(artifact.attemptId,mission.activeAttemptId);assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.equal(mission.events.at(-1).type,'DEPLOYMENT_INSPECTED');assert.equal(setup(t,saves.at(-1)).hub.state.missions[0].artifacts[0].kind,'deployment');
});

test('deployment refresh after acceptance preserves acceptance and failed lookup releases the lock',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});await selectFixtureReply(hub,mission);await hub.acceptMission(acceptanceInput(mission));const accepted=structuredClone(mission.acceptance);
 hub.deployments.inspect=async()=>{throw Error('Lookup unavailable');};await assert.rejects(hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,deployment:true}),/Lookup unavailable/);assert.equal(hub.missionActions.has(mission.id),false);assert.equal(hub.gate.blocked(process.cwd()),false);assert.equal(mission.artifacts.length,0);
 hub.deployments.inspect=async()=>({kind:'deployment',deployments:[],recordedAt:1});await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,deployment:true});assert.equal(mission.status,'COMPLETE');assert.deepEqual(mission.acceptance,accepted);
});
test('mission launches real Hub task and persists evidence before snapshot',async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);
 const task=await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 assert.equal(task.projectId,'p');assert.equal(task.id,mission.attempts[0].taskId);
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.equal(saves.at(-1).missionBook.missions[0].status,'WAITING_FOR_REVIEW');
 await selectFixtureReply(hub,mission);await hub.acceptMission(acceptanceInput(mission));
 assert.equal(saves.at(-1).missionBook.missions[0].status,'COMPLETE');
});
test('failed durable begin never submits provider work',async t=>{
 const {hub,store}=setup(t);const mission=hub.createMission(brief);let calls=0;hub.client.request=async()=>{calls++;return {};};
 store.save=()=>{throw Error('Disk full');};
 await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'}),/Disk full/);
 assert.equal(calls,0);assert.equal(hub.state.missions[0].status,'DRAFT');store.save=()=>{};
});
test('legacy tasks remain unchanged and new ledger survives reload',t=>{
 const legacy={id:'old',status:'finished',messages:[]};const {hub,saves}=setup(t,{tasks:[legacy]});
 const mission=hub.createMission(brief);hub.persist();
 const {hub:restored}=setup(t,saves.at(-1));assert.deepEqual(restored.state.tasks,[legacy]);assert.equal(restored.state.missions[0].id,mission.id);
});
test('completed mission attempts cannot receive untracked workbench follow-ups',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);const task=await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 await assert.rejects(hub.send(task.id,'One more change'),/new attempt|mission board/i);
 assert.equal(mission.status,'WAITING_FOR_REVIEW');
});
test('failed task checkpoint after durable begin still prevents provider dispatch',async t=>{
 const {hub,store}=setup(t);const mission=hub.createMission(brief);let calls=0;hub.client.request=async()=>{calls++;return {};};
 store.save=data=>{if(data.tasks.length)throw Error('Task checkpoint failed');};
 await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'}),/Task checkpoint failed/);
 assert.equal(calls,0);store.save=()=>{};
});
test('restart recovers a durable launch reservation with no submitted task',t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);
 hub.missionBook.begin(mission.id,mission.revision);
 const {hub:restored}=setup(t,{missionBook:structuredClone(hub.missionBook.data),tasks:[]});
 assert.equal(restored.state.missions[0].status,'FAILED');
 assert.match(restored.state.missions[0].attempts[0].error,/before.*task|not submitted/i);
});
test('recovery during send cannot append work to an attempt that just finished',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);const task=await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 task.status='unknown';hub.changed();let submitted=0;
 hub.client.request=async method=>{if(method==='thread/read')return {thread:{status:{type:'idle'},turns:[{id:'turn',status:'completed'}]}};if(method==='turn/start'){submitted++;return {turn:{id:'new'}};}return {};};
 await assert.rejects(hub.send(task.id,'Do more'),/new attempt|mission board/i);
 assert.equal(submitted,0);assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.equal(hub.gate.active.has(task.id),false);
});
test('completion arriving during resume prevents a new turn without changing its result',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);const task=await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 task.status='idle';hub.gate.release(task.id);hub.loaded.delete(task.id);let submitted=0;
 hub.client.request=async method=>{if(method==='thread/resume'){hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});return {}; }if(method==='turn/start'){submitted++;return {turn:{id:'new'}};}return {};};
 await assert.rejects(hub.send(task.id,'Do more'),/new attempt|mission board/i);
 assert.equal(submitted,0);assert.equal(task.status,'finished');assert.equal(hub.gate.active.has(task.id),false);
});
test('check evidence attaches to the finished attempt and releases its checkout',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 hub.evidence={runCheck:async()=>({kind:'check',script:'test',command:'npm run test',status:'passed',exitCode:0,fingerprint:'source',recordedAt:1})};
 await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,script:'test'});
 assert.equal(mission.artifacts[0].attemptId,mission.activeAttemptId);assert.equal(mission.artifacts[0].status,'passed');assert.equal(hub.gate.active.size,0);
});
test('an in-flight check blocks retry and acceptance; rejected check releases checkout',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let finish;hub.evidence={runCheck:()=>new Promise((_resolve,reject)=>{finish=reject;})};
 const checking=hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,script:'test'});
 await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'}),/check|evidence/i);
 await assert.rejects(Promise.resolve().then(()=>hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]})),/check|evidence/i);
 finish(Error('Unavailable'));await assert.rejects(checking,/Unavailable/);assert.equal(hub.gate.active.size,0);
});
test('failed or stale latest checks prevent mission acceptance',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 hub.evidence={runCheck:async()=>({kind:'check',script:'test',status:'failed',exitCode:1,fingerprint:'old'}),gitState:async()=>({fingerprint:'new'})};
 await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,script:'test'});
 await assert.rejects(Promise.resolve().then(()=>hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]})),/check|passed/i);
 hub.evidence.runCheck=async()=>({kind:'check',script:'test',status:'passed',exitCode:0,fingerprint:'old'});
 await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,script:'test'});
 await assert.rejects(Promise.resolve().then(()=>hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]})),/changed|stale/i);
 assert.equal(mission.status,'WAITING_FOR_REVIEW');
});

test('mission role routing persists before provider submission and rejects unknown roles without an attempt',async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);
 await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'unavailable'}),/role/i);assert.equal(mission.attempts.length,0);
 let routeAtSubmission;hub.client.request=async method=>{if(method==='thread/start'){routeAtSubmission=saves.at(-1).missionBook.missions[0].attempts[0].routing;return {thread:{id:'thread'}};}return {turn:{id:'turn'}};};
 const task=await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});
 assert.equal(task.crewId,'franky');assert.equal(routeAtSubmission.roleId,'builder');assert.equal(routeAtSubmission.provider,'codex');assert.ok(mission.events.some(e=>e.type==='ROUTING_DECIDED'));assert.match(task.selectionReason,/Builder/);
});

test('merge-bound acceptance refreshes exact PR evidence and records the proof',async t=>{
 const {hub}=setup(t);const mission=hub.createMission({...brief,completionBoundary:'merge'});await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let reads=0;hub.pullRequests.inspect=async()=>{reads++;return {kind:'pull-request',number:1,url:'https://github.com/fixture/sunny/pull/1',repository:'fixture/sunny',commit:'a'.repeat(40),fingerprint:'source',state:reads>1?'MERGED':'OPEN',mergedAt:reads>1?'2026-09-21T12:00:00Z':null,checkStatus:'passed'};};
 await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,prNumber:1});
 await selectFixtureReply(hub,mission);await hub.acceptMission(acceptanceInput(mission));
 assert.equal(reads,2);assert.equal(mission.status,'COMPLETE');assert.equal(mission.acceptance.prArtifactId,mission.artifacts.at(-1).id);
});
test('unmerged or changed PR cannot satisfy merge-bound acceptance',async t=>{
 const {hub}=setup(t);const mission=hub.createMission({...brief,completionBoundary:'merge'});await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 const evidence={kind:'pull-request',number:1,url:'https://github.com/fixture/sunny/pull/1',repository:'fixture/sunny',commit:'a'.repeat(40),fingerprint:'source',state:'OPEN',checkStatus:'passed'};hub.pullRequests.inspect=async()=>({...evidence});
 await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,prNumber:1});await assert.rejects(hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]}),/merged/i);
 hub.pullRequests.inspect=async()=>({...evidence,state:'MERGED',mergedAt:'2026-09-21T12:00:00Z',commit:'b'.repeat(40)});await assert.rejects(hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]}),/changed/i);assert.equal(mission.status,'WAITING_FOR_REVIEW');
});

test('merge acceptance cannot use cached proof when fresh GitHub verification fails',async t=>{
 const {hub}=setup(t);const mission=hub.createMission({...brief,completionBoundary:'merge'});await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 const evidence={kind:'pull-request',number:1,url:'https://github.com/fixture/sunny/pull/1',commit:'a'.repeat(40),fingerprint:'source',state:'MERGED',mergedAt:'2026-09-21T12:00:00Z',checkStatus:'passed'};hub.pullRequests.inspect=async()=>evidence;
 await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,prNumber:1});hub.pullRequests.inspect=async()=>{throw Error('GitHub unavailable');};
 await assert.rejects(hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]}),/unavailable/);assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.equal(hub.gate.active.size,0);
 hub.pullRequests.inspect=async()=>({...evidence,checkStatus:'failed'});await assert.rejects(hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]}),/passing checks/);assert.equal(mission.status,'WAITING_FOR_REVIEW');
});

test('branch intent is durable before switching and unresolved preparation blocks launch',async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);const plan={name:'codex/sunny-fixture',baseCommit:'a'.repeat(40),state:'preparing'};
 hub.branches={plan:async()=>plan,create:async()=>{assert.equal(saves.at(-1).missionBook.missions[0].branch.state,'preparing');throw Error('Switch interrupted');},validate:async()=>{throw Error('Return to prepared branch');},inspect:async()=>({ready:true})};
 await assert.rejects(hub.prepareMissionBranch({missionId:mission.id,revision:mission.revision}),/interrupted/);assert.equal(mission.branch.state,'preparing');
 await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'}),/prepared branch/);assert.equal(mission.attempts.length,0);
 await hub.prepareMissionBranch({missionId:mission.id,revision:mission.revision});assert.equal(mission.branch.state,'ready');assert.equal(hub.gate.active.size,0);
});
test('failed branch intent persistence prevents git mutation',async t=>{
 const {hub,store}=setup(t);const mission=hub.createMission(brief);let switched=false;
 hub.branches={plan:async()=>({name:'codex/sunny-fixture',state:'preparing'}),create:async()=>{switched=true;}};store.save=()=>{throw Error('Disk full');};
 await assert.rejects(hub.prepareMissionBranch({missionId:mission.id,revision:mission.revision}),/Disk full/);assert.equal(switched,false);assert.equal(hub.state.missions[0].branch,undefined);store.save=()=>{};
});

test('PR publication needs exact confirmation and durable authorization before remote submission',async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let published=0;hub.publisher={prepare:async()=>({id:'preview',attemptId:mission.activeAttemptId,state:'prepared',expiresAt:Date.now()+10000}),validate:async()=>{},publish:async()=>{published++;assert.equal(saves.at(-1).missionBook.missions[0].prPublication.state,'publishing');return {number:7,url:'https://github.com/fixture/sunny/pull/7'};}};
 await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:false},'publish'),/confirm/);assert.equal(published,0);
 await hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:true},'publish');assert.equal(published,1);assert.equal(mission.prPublication.state,'published');
 await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:true},'publish'),/confirm/);assert.equal(published,1);
});
test('uncertain PR publication cannot automatically retry or restart work',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let published=0;hub.publisher={prepare:async()=>({id:'preview',attemptId:mission.activeAttemptId,state:'prepared',expiresAt:Date.now()+10000}),validate:async()=>{},publish:async()=>{published++;throw Error('Timeout');}};
 await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:true},'publish'),/may have reached/);assert.equal(mission.prPublication.state,'uncertain');
 await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare'),/Reconcile/);await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'}),/Reconcile/);assert.equal(published,1);
});

test('a new attempt can prepare and reconcile a previously published PR at its new source',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);
 await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 const oldAttempt=mission.activeAttemptId;mission.prPublication={id:'old',attemptId:oldAttempt,state:'published',number:7};
 await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 hub.publisher.prepare=async()=>({id:'new',attemptId:mission.activeAttemptId,state:'prepared',repository:'fixture/sunny',commit:'b'.repeat(40),base:'main'});
 await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');
 hub.pullRequests.inspect=async()=>({kind:'pull-request',repository:'fixture/sunny',number:7,url:'https://github.com/fixture/sunny/pull/7',commit:'b'.repeat(40),baseBranch:'main'});
 await hub.publication.act({missionId:mission.id,revision:mission.revision,prNumber:7},'reconcile');
 assert.equal(mission.prPublication.state,'published');assert.equal(mission.prPublication.attemptId,mission.activeAttemptId);assert.equal(mission.publicationHistory[0].attemptId,oldAttempt);assert.equal(mission.artifacts.at(-1).attemptId,mission.activeAttemptId);
});

test('failed PR authorization persistence prevents remote submission',async t=>{
 const {hub,store}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let calls=0;hub.publisher={prepare:async()=>({id:'preview',attemptId:mission.activeAttemptId,state:'prepared',expiresAt:Date.now()+10000}),validate:async()=>{},publish:async()=>{calls++;}};await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');
 store.save=()=>{throw Error('Disk full');};await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:true},'publish'),/Disk full/);assert.equal(calls,0);store.save=()=>{};
});
test('expired PR previews cannot be authorized',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let calls=0;hub.publisher={prepare:async()=>({id:'preview',attemptId:mission.activeAttemptId,state:'prepared',expiresAt:1}),validate:async()=>{calls++;}};await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:true},'publish'),/unexpired/);assert.equal(calls,0);
});

test('signal receipt persists before broadcast and rolls back on save failure',t=>{
 const {hub,store,saves}=setup(t);const mission=hub.createMission(brief),eventId=mission.events[0].id;
 store.save=()=>{throw Error('Disk full');};
 assert.throws(()=>hub.markMissionSignalSeen({missionId:mission.id,revision:mission.revision,eventId}),/Disk full/);
 assert.equal(hub.state.missions[0].seenEventIds,undefined);
 store.save=data=>saves.push(structuredClone(data));
 hub.markMissionSignalSeen({missionId:mission.id,revision:hub.state.missions[0].revision,eventId});
 assert.deepEqual(saves.at(-1).missionBook.missions[0].seenEventIds,[eventId]);
 assert.throws(()=>hub.markMissionSignalSeen({missionId:mission.id,revision:hub.state.missions[0].revision,eventId,approved:true}),/Invalid/);
});

test('receipt cannot invalidate evidence while a mission action is in flight',t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief),revision=mission.revision;
 hub.missionActions.add(mission.id);
 assert.throws(()=>hub.markMissionSignalSeen({missionId:mission.id,revision,eventId:mission.events[0].id}),/current mission action/i);
 assert.equal(mission.revision,revision);assert.equal(mission.seenEventIds,undefined);
 hub.missionActions.delete(mission.id);
 hub.markMissionSignalSeen({missionId:mission.id,revision,eventId:mission.events[0].id});assert.equal(mission.seenEventIds.length,1);
});

test('creative text evidence previews exact bytes and blocks changed output at acceptance',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-creative-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const {hub,saves}=setup(t);hub.state.projects[0].path=root;let mission=hub.createMission({...brief,title:'Captain welcome',objective:'Write an original welcome note'});
 await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'creator'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 fs.writeFileSync(path.join(root,'welcome.md'),'# Welcome aboard\nAn original captain note.');
 const artifact=await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,filePath:'welcome.md'});
 assert.equal(artifact.kind,'deliverable');assert.equal(artifact.text,undefined);assert.equal(saves.at(-1).missionBook.missions[0].artifacts[0].text,undefined);
 assert.match(hub.previewMissionDeliverable({missionId:mission.id,revision:mission.revision,artifactId:artifact.id}).text,/Welcome aboard/);
 await selectDeliverable(hub,mission,artifact);
 const other=hub.createMission(brief);assert.throws(()=>hub.previewMissionDeliverable({missionId:other.id,revision:other.revision,artifactId:artifact.id}),/not found/i);
 fs.appendFileSync(path.join(root,'welcome.md'),' Updated.');
 assert.throws(()=>hub.previewMissionDeliverable({missionId:mission.id,revision:mission.revision,artifactId:artifact.id}),/changed/i);
 await assert.rejects(hub.acceptMission(acceptanceInput(mission)),/changed/i);assert.equal(mission.status,'WAITING_FOR_REVIEW');mission=hub.missionBook.get(mission.id);
 const currentArtifact=await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,filePath:'welcome.md'});await selectDeliverable(hub,mission,currentArtifact);
 await hub.acceptMission(acceptanceInput(mission));assert.equal(mission.status,'COMPLETE');assert.equal(hub.gate.active.size,0);assert.equal(mission.acceptance.resultId,mission.selectedResult.id);assert.equal(mission.acceptance.resultSha256,currentArtifact.sha256);
});

test('image tool activity is visible without leaking image payloads or granting mission acceptance',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);const task=await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'creator'});
 const item={id:'image-call',type:'imageGeneration',status:'in_progress',result:'PRIVATE_IMAGE_PAYLOAD',revisedPrompt:'PRIVATE_TOOL_PROMPT'};
 hub.notification({method:'item/started',params:{threadId:'thread',turnId:'turn',item}});
 assert.match(task.messages.find(m=>m.id==='activity:image-call')?.text||'',/Started.*Image generation/);
 hub.notification({method:'item/completed',params:{threadId:'thread',turnId:'turn',item:{...item,status:'completed'}}});
 assert.equal(task.messages.filter(m=>m.id==='activity:image-call').length,1);
 assert.match(task.messages.find(m=>m.id==='activity:image-call').text,/Completed.*Image generation/);
 hub.notification({method:'item/completed',params:{threadId:'thread',turnId:'turn',item:{...item,status:'failed'}}});assert.match(task.messages.find(m=>m.id==='activity:image-call').text,/failed/);
 assert.equal(JSON.stringify(task.messages).includes('PRIVATE_'),false);assert.equal(mission.status,'RUNNING');assert.equal(mission.artifacts.length,0);
});
