const {test}=require('node:test');const assert=require('node:assert/strict');const {Hub}=require('../desktop/hub.cjs');
function setup(t,initial={}){
 const saves=[];const store={load:()=>initial,save:data=>saves.push(structuredClone(data)),close:()=>{}};
 const hub=new Hub({home:process.cwd(),store,catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 t.after(()=>hub.close());hub.client.connected=true;hub.state.codex.status='connected';
 hub.client.request=async method=>method==='thread/start'?{thread:{id:'thread'}}:method==='turn/start'?{turn:{id:'turn'}}:{};
 return {hub,store,saves};
}
const brief={projectId:'p',title:'Inventory',objective:'Track items',acceptanceCriteria:['Saved items reload'],completionBoundary:'review'};

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
 await restored.hub.collectMissionEvidence({missionId:m.id,revision:restored.hub.state.missions[0].revision,script:'test'});await restored.hub.acceptMission({missionId:m.id,revision:restored.hub.state.missions[0].revision,criteria:[true]});assert.equal(restored.hub.state.missions[0].status,'COMPLETE');
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
 const changed=Buffer.from(png);changed[45]^=1;fs.writeFileSync(path.join(root,'art.png'),changed);assert.throws(()=>hub.previewMissionDeliverable({missionId:mission.id,revision:mission.revision,artifactId:a.id}),/changed/i);await assert.rejects(hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]}),/changed/i);assert.equal(mission.status,'WAITING_FOR_REVIEW');
});

test('deployment observations attach to current attempt without granting acceptance and survive reload',async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 hub.deployments.inspect=async()=>({kind:'deployment',commit:'a'.repeat(40),repository:'owner/repo',deployments:[],recordedAt:1});
 await assert.rejects(hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,deployment:true,script:'test'}),/one/i);
 await assert.rejects(hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,deployment:'yes'}),/deployment/i);
 const artifact=await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,deployment:true});assert.equal(artifact.attemptId,mission.activeAttemptId);assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.equal(mission.events.at(-1).type,'DEPLOYMENT_INSPECTED');assert.equal(setup(t,saves.at(-1)).hub.state.missions[0].artifacts[0].kind,'deployment');
});

test('deployment refresh after acceptance preserves acceptance and failed lookup releases the lock',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});await hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]});const accepted=structuredClone(mission.acceptance);
 hub.deployments.inspect=async()=>{throw Error('Lookup unavailable');};await assert.rejects(hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,deployment:true}),/Lookup unavailable/);assert.equal(hub.missionActions.has(mission.id),false);assert.equal(hub.gate.blocked(process.cwd()),false);assert.equal(mission.artifacts.length,0);
 hub.deployments.inspect=async()=>({kind:'deployment',deployments:[],recordedAt:1});await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,deployment:true});assert.equal(mission.status,'COMPLETE');assert.deepEqual(mission.acceptance,accepted);
});
test('mission launches real Hub task and persists evidence before snapshot',async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);
 const task=await hub.startMission({missionId:mission.id,revision:mission.revision,crewId:'franky'});
 assert.equal(task.projectId,'p');assert.equal(task.id,mission.attempts[0].taskId);
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.equal(saves.at(-1).missionBook.missions[0].status,'WAITING_FOR_REVIEW');
 await hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]});
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
 await hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]});
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
 let published=0;hub.publisher={prepare:async()=>({id:'preview',attemptId:mission.activeAttemptId,state:'prepared',title:'Fixture PR',body:'Fixture description',expiresAt:Date.now()+10000}),validate:async()=>{},publish:async()=>{published++;assert.equal(saves.at(-1).missionBook.missions[0].prPublication.state,'publishing');return {number:7,url:'https://github.com/fixture/sunny/pull/7'};}};
 await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:false},'publish'),/confirm/);assert.equal(published,0);
 await hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:true},'publish');assert.equal(published,1);assert.equal(mission.prPublication.state,'published');
 await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:true},'publish'),/confirm/);assert.equal(published,1);
});
test('uncertain PR publication cannot automatically retry or restart work',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let published=0;hub.publisher={prepare:async()=>({id:'preview',attemptId:mission.activeAttemptId,state:'prepared',title:'Fixture PR',body:'Fixture description',expiresAt:Date.now()+10000}),validate:async()=>{},publish:async()=>{published++;throw Error('Timeout');}};
 await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:true},'publish'),/may have reached/);assert.equal(mission.prPublication.state,'uncertain');
 await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare'),/Reconcile/);await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'}),/Reconcile/);assert.equal(published,1);
});

test('a new attempt can prepare and reconcile a previously published PR at its new source',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);
 await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 const oldAttempt=mission.activeAttemptId;mission.prPublication={id:'old',attemptId:oldAttempt,state:'published',number:7};
 await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 hub.publisher.prepare=async()=>({id:'new',attemptId:mission.activeAttemptId,state:'prepared',title:'Fixture PR',body:'Fixture description',repository:'fixture/sunny',commit:'b'.repeat(40),base:'main'});
 await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');
 hub.pullRequests.inspect=async()=>({kind:'pull-request',repository:'fixture/sunny',number:7,url:'https://github.com/fixture/sunny/pull/7',commit:'b'.repeat(40),baseBranch:'main'});
 await hub.publication.act({missionId:mission.id,revision:mission.revision,prNumber:7},'reconcile');
 assert.equal(mission.prPublication.state,'published');assert.equal(mission.prPublication.attemptId,mission.activeAttemptId);assert.equal(mission.publicationHistory[0].attemptId,oldAttempt);assert.equal(mission.artifacts.at(-1).attemptId,mission.activeAttemptId);
});

test('failed PR authorization persistence prevents remote submission',async t=>{
 const {hub,store}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let calls=0;hub.publisher={prepare:async()=>({id:'preview',attemptId:mission.activeAttemptId,state:'prepared',title:'Fixture PR',body:'Fixture description',expiresAt:Date.now()+10000}),validate:async()=>{},publish:async()=>{calls++;}};await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');
 store.save=()=>{throw Error('Disk full');};await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:true},'publish'),/Disk full/);assert.equal(calls,0);store.save=()=>{};
});
test('expired PR previews cannot be authorized',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let calls=0;hub.publisher={prepare:async()=>({id:'preview',attemptId:mission.activeAttemptId,state:'prepared',title:'Fixture PR',body:'Fixture description',expiresAt:1}),validate:async()=>{calls++;}};await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'preview',confirmed:true},'publish'),/unexpired/);assert.equal(calls,0);
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
 const other=hub.createMission(brief);assert.throws(()=>hub.previewMissionDeliverable({missionId:other.id,revision:other.revision,artifactId:artifact.id}),/not found/i);
 fs.appendFileSync(path.join(root,'welcome.md'),' Updated.');
 assert.throws(()=>hub.previewMissionDeliverable({missionId:mission.id,revision:mission.revision,artifactId:artifact.id}),/changed/i);
 await assert.rejects(hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]}),/changed/i);assert.equal(mission.status,'WAITING_FOR_REVIEW');mission=hub.missionBook.get(mission.id);
 await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,filePath:'welcome.md'});
 await hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]});assert.equal(mission.status,'COMPLETE');assert.equal(hub.gate.active.size,0);
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
for(const accepted of [false,true])test(`mission handoff cannot dispatch unlinked work from ${accepted?'accepted':'review-ready'} attempt`,async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);const task=await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 if(accepted)await hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]});
 let calls=0;hub.client.request=async()=>{calls++;return {thread:{id:'handoff'},turn:{id:'handoff-turn'}};};
 const count=hub.state.tasks.length,revision=mission.revision;
 await assert.rejects(hub.handoff({taskId:task.id,crewId:'usopp',prompt:'Continue this mission.'}),/new attempt|mission board/i);
 assert.equal(calls,0);assert.equal(hub.state.tasks.length,count);assert.equal(mission.revision,revision);assert.equal(hub.gate.active.size,0);
});
test('completed coordinated stage cannot hand off while coordinator still runs',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);const attempt=hub.missionBook.begin(mission.id,mission.revision);attempt.workflowVersion=1;
 const child={id:'builder-child',projectId:'p',parentTaskId:attempt.taskId,crewId:'franky',threadId:'builder-thread',status:'finished',messages:[]};
 attempt.taskIds.push(child.id);hub.state.tasks.push(child);let calls=0;hub.client.request=async()=>{calls++;return {thread:{id:'handoff'},turn:{id:'turn'}};};
 await assert.rejects(hub.handoff({taskId:child.id,crewId:'usopp',prompt:'Continue this mission.'}),/new attempt|mission board/i);assert.equal(calls,0);assert.equal(hub.state.tasks.length,1);
});
test('ordinary finished conversation retains explicit handoff',async t=>{
 const {hub}=setup(t);const task=await hub.start({projectId:'p',crewId:'franky',prompt:'Fixture work'});
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 const next=await hub.handoff({taskId:task.id,crewId:'usopp',prompt:'Review fixture work'});assert.notEqual(next.id,task.id);assert.equal(next.crewId,'usopp');assert.equal(next.status,'working');
});
test('unavailable checks leave review acceptance and attempt evidence intact',async t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});
 hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let executions=0;hub.evidence.execute=async()=>{executions++;return {exitCode:0};};const revision=mission.revision;
 await assert.rejects(hub.collectMissionEvidence({missionId:mission.id,revision,script:'lint'}),/unavailable/i);
 assert.equal(executions,0);assert.equal(mission.checkExecution,undefined);assert.equal(mission.artifacts.length,0);assert.equal(mission.revision,revision);assert.equal(hub.gate.active.size,0);
 await hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true]});assert.equal(mission.status,'COMPLETE');
});
test('read-only check capabilities validate mission scope and report only configured scripts',t=>{
 const {hub}=setup(t);const mission=hub.createMission(brief);
 assert.deepEqual(hub.missionCheckCapabilities({missionId:mission.id}),['test','build']);
 assert.throws(()=>hub.missionCheckCapabilities({missionId:'missing'}),/not found/i);
 assert.throws(()=>hub.missionCheckCapabilities({missionId:mission.id,projectId:'other'}),/Invalid/i);
});
test('editing a PR preview durably replaces identity and invalidates earlier confirmation',async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let published=0;hub.publisher={prepare:async()=>({id:'old-preview',attemptId:mission.activeAttemptId,state:'prepared',expiresAt:Date.now()+10000,title:'Original',body:'Original body'}),validate:async()=>{},revise:async(_root,preview,title,body)=>({...preview,id:'edited-preview',title,body}),publish:async()=>{published++;return {number:7,url:'https://github.com/fixture/sunny/pull/7'};}};
 await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');const revision=mission.revision;
 await hub.publication.act({missionId:mission.id,revision,previewId:'old-preview',title:'Reviewed title',body:'Reviewed body'},'edit');
 assert.equal(saves.at(-1).missionBook.missions[0].prPublication.body,'Reviewed body');assert.equal(mission.prPublication.id,'edited-preview');assert.ok(mission.revision>revision);
 await assert.rejects(hub.publication.act({missionId:mission.id,revision,previewId:'old-preview',confirmed:true},'publish'),/changed/i);
 await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'old-preview',confirmed:true},'publish'),/current|confirm/i);assert.equal(published,0);
 await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'edited-preview',title:'Title',body:'Body',base:'other'},'edit'),/Invalid/i);
 await hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'edited-preview',confirmed:true},'publish');assert.equal(published,1);
 await assert.rejects(hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'edited-preview',title:'Later',body:'Later body'},'edit'),/prepared|preview|reconcile/i);
});
test('failed edited-preview checkpoint preserves old identity and never publishes',async t=>{
 const {hub,store}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let remote=0;hub.publisher={prepare:async()=>({id:'old',attemptId:mission.activeAttemptId,state:'prepared',title:'Old',body:'Old body'}),revise:async(_root,preview,title,body)=>({...preview,id:'new',title,body}),publish:async()=>{remote++;}};
 await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');const revision=mission.revision;store.save=()=>{throw Error('Disk full');};
 await assert.rejects(hub.publication.act({missionId:mission.id,revision,previewId:'old',title:'New',body:'New body'},'edit'),/Disk full/);
 assert.equal(hub.state.missions[0].prPublication.id,'old');assert.equal(hub.state.missions[0].revision,revision);assert.equal(remote,0);assert.equal(hub.gate.active.size,0);store.save=()=>{};
});
for(const invalid of [{title:'Invalid\ntitle',body:'Body'},{title:'Title',body:'x'.repeat(60001)}])test(`invalid prepared PR ${invalid.title.includes('\n')?'title':'body'} cannot authorize or enter uncertain publication`,async t=>{
 const {hub,saves}=setup(t);const mission=hub.createMission(brief);await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'builder'});hub.notification({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
 let external=0;hub.publisher={prepare:async()=>({id:'invalid-preview',attemptId:mission.activeAttemptId,state:'prepared',expiresAt:Date.now()+10000,...invalid}),validate:async()=>{},publish:async()=>{external++;return {number:7};}};
 await hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare');const revision=mission.revision,count=saves.length;
 await assert.rejects(hub.publication.act({missionId:mission.id,revision,previewId:'invalid-preview',confirmed:true},'publish'),/invalid.*PR/i);
 assert.equal(external,0);assert.equal(mission.revision,revision);assert.equal(saves.length,count);assert.equal(mission.prPublication.state,'prepared');assert.equal(mission.prPublication.authorizedAt,undefined);assert.equal(hub.gate.active.size,0);
});
