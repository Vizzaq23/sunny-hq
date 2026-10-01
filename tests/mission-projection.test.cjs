const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');

function project(snapshot,context){
 let api;try{api=require('../src/missionProjection.ts');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
 assert.equal(typeof api?.projectMission,'function','shared mission projection must exist');
 return api.projectMission(snapshot,context);
}
const context=(extra={})=>({projectId:'p',surface:'franky',returnTo:{view:'deck',projectId:'p'},...extra});
const task=(id='root',status='working',extra={})=>({id,status,projectId:'p',crewId:'franky',title:'Work',createdAt:1,updatedAt:1,transcriptRevision:1,messageCount:0,...extra});
const attempt=(extra={})=>({id:'a',taskId:'root',taskIds:['root'],status:'working',startedAt:1,...extra});
const mission=(extra={})=>({id:'m',projectId:'p',title:'Voyage',objective:'Build',acceptanceCriteria:['Works'],completionBoundary:'review',status:'RUNNING',connection:'connected',revision:4,createdAt:1,updatedAt:1,taskIds:['root'],activeAttemptId:'a',attempts:[attempt()],artifacts:[],events:[],...extra});
const snapshot=(extra={})=>({projects:[{id:'p',name:'Project',path:'fixture',category:'coding'}],tasks:[task()],missions:[],approvals:[],workspace:{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]},settings:{reducedMotion:false,notifications:false},persistence:{state:'saved',failures:0},codex:{status:'connected'},tools:[],models:[],usage:{},automations:[],...extra});
const approval=(taskId='root',method='item/commandExecution/requestApproval')=>({id:'request',taskId,method,params:{}});
function coordinated(stage='work',status='working'){
 const stages=['plan','work','validate','review'];const owners=['nami','franky','usopp','zoro'];const index=stages.indexOf(stage);
 const tasks=[task('root','working',{crewId:'luffy'}),...stages.slice(0,index+1).map((id,i)=>task(id,i===index?status:'finished',{crewId:owners[i],parentTaskId:'root'}))];
 const a=attempt({taskIds:tasks.map(t=>t.id),workflowVersion:1,workflow:{complete:false,stages:stages.map((id,i)=>({id,status:i<index?'complete':i===index?status:'pending',...(i<=index?{taskId:id}:{})}))}});
 return snapshot({tasks,missions:[mission({taskIds:a.taskIds,attempts:[a]})]});
}
function accepted(refKind='reply'){
 const text='A saved result';const sha256=createHash('sha256').update(text,'utf8').digest('hex');
 const t=task('root','finished',{transcriptRevision:1,messageCount:1});delete t.messages;
 const ref=refKind==='reply'?{kind:'reply',taskId:'root',messageId:'message',sha256}:{kind:'deliverable',artifactId:'artifact',sha256};
 const result={id:'result',attemptId:'a',producerTaskId:'root',ref,selectedAt:2};
 const receipt={id:'receipt',actor:'captain',attemptId:'a',reviewedRevision:3,resultId:'result',resultSha256:sha256,criteria:[true],acceptedAt:3};
 const m=mission({status:'COMPLETE',attempts:[attempt({status:'finished'})],selectedResult:result,acceptance:receipt,acceptedAt:3,artifacts:refKind==='deliverable'?[{id:'artifact',kind:'deliverable',projectId:'p',attemptId:'a',producer:'Franky',sha256,recordedAt:2}]:[]});
 const s=snapshot({epoch:'e',tasks:[t],missions:[m]});
 s.resultStatuses={m:{key:require('../src/workContext.ts').resultStatusKey(s,m),state:'ready',status:{epoch:'e',missionId:'m',revision:m.revision,attemptId:'a',resultId:'result',producerTaskId:'root',ref,available:true,preview:text}}};
 return s;
}

test('project context without a selection is idle even with newer active work and a saved workspace selection',()=>{
 const s=snapshot({missions:[mission()],workspace:{version:1,revision:0,context:context({missionId:'m'}),drafts:[],seenAcceptanceIds:[]}});
 assert.deepEqual(project(s,context()),{state:'idle',label:'Idle',working:false});
});

for(const [status,state,working] of [['idle','idle',false],['starting','starting',false],['working','working',true],['running','working',true],['in-progress','working',true],['waiting','waiting',false],['awaiting-approval','approval',false],['unknown','unknown',false],['failed','failed',false],['interrupted','stopped',false],['finished','review',false],['completed','review',false],['unrecognized','unknown',false]]){
 test(`explicit standalone ${status} task projects ${state} with truthful motion`,()=>{
  const p=project(snapshot({tasks:[task('selected',status),task('newer','working',{updatedAt:99})]}),context({taskId:'selected'}));
  assert.equal(p.taskId,'selected');assert.equal(p.crewId,'franky');assert.equal(p.state,state);assert.equal(p.working,working);assert.ok(p.label);assert.equal(p.acceptanceId,undefined);
 });
}

test('finished turn and COMPLETE without a bound receipt never imply accepted',()=>{
 const s=snapshot({tasks:[task('root','finished')],missions:[mission({status:'COMPLETE',attempts:[attempt({status:'finished'})]})]});
 const p=project(s,context({missionId:'m'}));assert.equal(p.state,'review');assert.equal(p.working,false);assert.equal(p.acceptanceId,undefined);
});

for(const [selected,status,state] of [['plan','working','working'],['work','working','working'],['validate','working','working'],['review','working','working'],['work','starting','starting']]){
 test(`mission projection follows actual ${selected} stage owner rather than coordinator or newest task`,()=>{
  const s=coordinated(selected,status);s.tasks.push(task('unrelated','working',{updatedAt:999}));
  const p=project(s,context({missionId:'m'}));assert.equal(p.taskId,selected);assert.equal(p.stage,selected);assert.equal(p.crewId,{plan:'nami',work:'franky',validate:'usopp',review:'zoro'}[selected]);assert.equal(p.state,state);assert.equal(p.working,status==='working');
  if(selected!=='work')assert.notEqual(p.crewId,'franky');
 });
}

test('explicit completed task remains selected while its attempt proceeds to another stage',()=>{
 const s=coordinated('validate');const p=project(s,context({missionId:'m',attemptId:'a',taskId:'work'}));
 assert.equal(p.taskId,'work');assert.equal(p.stage,'work');assert.equal(p.state,'review');assert.equal(p.working,false);
});

test('unassigned structured stage waits without inventing a Franky builder',()=>{
 const s=coordinated('work');s.tasks.find(t=>t.id==='work').status='finished';s.missions[0].attempts[0].workflow.stages[1].status='complete';
 const p=project(s,context({missionId:'m'}));assert.equal(p.state,'waiting');assert.equal(p.stage,'validate');assert.equal(p.working,false);assert.notEqual(p.crewId,'franky');
});

test('a stage reference outside attempt membership is unknown',()=>{
 const s=coordinated();s.missions[0].attempts[0].workflow.stages[1].taskId='outsider';s.tasks.push(task('outsider'));
 const p=project(s,context({missionId:'m'}));assert.equal(p.state,'unknown');assert.equal(p.working,false);
});

test('root role routing labels a planner without inferring a stage from crew identity or text',()=>{
 const m=mission({attempts:[attempt({routing:{roleId:'planner',crewId:'nami',provider:'codex',reason:'selected'}})]});
 let p=project(snapshot({missions:[m],tasks:[task('root','working',{crewId:'nami'})]}),context({missionId:'m'}));assert.equal(p.stage,'plan');assert.equal(p.label,'Planning');
 p=project(snapshot({tasks:[task('root','working',{crewId:'nami',title:'Review approved build',messages:[{id:'x',role:'assistant',text:'Accepted and finished planning',time:1}]})]}),context({taskId:'root'}));assert.equal(p.state,'working');assert.equal(p.label,'Working');assert.equal(p.stage,undefined);
});

test('selected earlier attempt is not overwritten by newer active work, receipts, connection or approvals',()=>{
 const old=attempt({id:'old',taskId:'old-task',taskIds:['old-task'],status:'finished'});const s=accepted();
 const m=s.missions[0];m.attempts.unshift(old);m.taskIds.unshift('old-task');m.connection='reconciling';s.tasks.push(task('old-task','finished'));s.approvals.push(approval());
 const p=project(s,context({missionId:'m',attemptId:'old'}));assert.equal(p.attemptId,'old');assert.equal(p.taskId,'old-task');assert.equal(p.state,'review');assert.equal(p.working,false);assert.equal(p.acceptanceId,undefined);assert.equal(p.result,undefined);
});

test('task-only context resolves its own historical attempt rather than the active attempt',()=>{
 const s=snapshot({missions:[mission({attempts:[attempt({id:'old',taskId:'old-task',taskIds:['old-task'],status:'finished'}),attempt()],taskIds:['old-task','root']})],tasks:[task('old-task','finished'),task()]});
 const p=project(s,context({taskId:'old-task'}));assert.equal(p.missionId,'m');assert.equal(p.attemptId,'old');assert.equal(p.taskId,'old-task');assert.equal(p.state,'review');assert.equal(p.working,false);
});

test('explicit attempt without mission resolves only a unique project-owned attempt',()=>{
 const s=snapshot({missions:[mission()]});const p=project(s,context({attemptId:'a'}));assert.equal(p.missionId,'m');assert.equal(p.attemptId,'a');assert.equal(p.state,'working');
 s.missions.push(mission({id:'other'}));assert.equal(project(s,context({attemptId:'a'})).state,'unknown');
});

test('missing and contradictory explicit references remain unavailable instead of falling back',()=>{
 const s=snapshot({missions:[mission()]});
 for(const c of [context({projectId:'missing'}),context({missionId:'missing'}),context({taskId:'missing'}),context({missionId:'m',attemptId:'missing'}),context({missionId:'m',taskId:'foreign'}),context({missionId:'m',attemptId:'a',taskId:'foreign'})]){
  const p=project(s,c);assert.equal(p.state,'unknown');assert.equal(p.working,false);assert.match(p.label,/unavailable/i);if(c.taskId)assert.equal(p.taskId,c.taskId);if(c.attemptId)assert.equal(p.attemptId,c.attemptId);
 }
 s.tasks.push(task('foreign'));assert.equal(project(s,context({missionId:'m',taskId:'foreign'})).state,'unknown');
 s.missions[0].projectId='other';assert.equal(project(s,context({missionId:'m'})).state,'unknown');
});

test('duplicate task or mission identities fail closed',()=>{
 const s=snapshot({missions:[mission()]});s.tasks.push(task());assert.equal(project(s,context({taskId:'root'})).state,'unknown');
 s.tasks.pop();s.missions.push(mission());assert.equal(project(s,context({missionId:'m'})).state,'unknown');
});

test('missing selected-attempt member cannot be disguised by another live task',()=>{
 const s=coordinated();s.tasks=s.tasks.filter(t=>t.id!=='plan');assert.equal(project(s,context({missionId:'m'})).state,'unknown');
});

test('permission approval anywhere in selected attempt overrides active Franky motion',()=>{
 const s=coordinated();s.approvals=[approval('root')];const p=project(s,context({missionId:'m',taskId:'work'}));assert.equal(p.state,'approval');assert.equal(p.working,false);assert.equal(p.taskId,'work');
});

test('structured user input and permission requests differ, with permission winning when both exist',()=>{
 const s=coordinated();s.approvals=[approval('root','item/tool/requestUserInput')];let p=project(s,context({missionId:'m'}));assert.equal(p.state,'input');assert.equal(p.working,false);
 s.approvals.push(approval('work'));p=project(s,context({missionId:'m'}));assert.equal(p.state,'approval');assert.equal(p.working,false);
});

test('unknown sibling and reconciling current mission each stop active motion; approval remains actionable',()=>{
 const s=coordinated();s.tasks.find(t=>t.id==='root').status='unknown';let p=project(s,context({missionId:'m'}));assert.equal(p.state,'unknown');assert.equal(p.working,false);
 s.approvals=[approval('work')];assert.equal(project(s,context({missionId:'m'})).state,'approval');
 s.approvals=[];s.tasks.find(t=>t.id==='root').status='working';s.missions[0].connection='reconciling';assert.equal(project(s,context({missionId:'m'})).state,'unknown');
});

test('unrelated project, mission and unowned approval cannot interrupt a selected task',()=>{
 const s=snapshot({tasks:[task(),task('other','unknown',{projectId:'other'}),task('new','waiting')],approvals:[approval('other'),approval('new'),{id:'unowned',method:'item/commandExecution/requestApproval',params:{}}]});
 const p=project(s,context({taskId:'root'}));assert.equal(p.state,'working');assert.equal(p.working,true);
});

for(const [status,state] of [['NEEDS_USER','input'],['BLOCKED','waiting'],['FAILED','failed'],['CANCELLED','stopped'],['WAITING_FOR_REVIEW','review']]){
 test(`current mission ${status} is still despite stale active task data`,()=>{
  const p=project(snapshot({missions:[mission({status})]}),context({missionId:'m'}));assert.equal(p.state,state);assert.equal(p.working,false);
 });
}

test('running project check and uncertain external actions never animate a builder',()=>{
 const s=snapshot({missions:[mission({checkExecution:{id:'check',attemptId:'a',script:'test',startedAt:2}})]});let p=project(s,context({missionId:'m'}));assert.equal(p.state,'waiting');assert.equal(p.stage,'validate');assert.equal(p.working,false);
 delete s.missions[0].checkExecution;s.missions[0].mergeRequest={attemptId:'a',state:'uncertain'};p=project(s,context({missionId:'m'}));assert.equal(p.state,'unknown');assert.equal(p.working,false);
});

for(const kind of ['reply','deliverable']){
 test(`modern ${kind} acceptance requires exact result receipt binding and exposes its stable cue identity`,()=>{
  const s=accepted(kind);const p=project(s,context({missionId:'m'}));assert.equal(p.state,'accepted');assert.equal(p.working,false);assert.equal(p.acceptanceId,'receipt');assert.deepEqual(p.result,s.missions[0].selectedResult);
  const replay=project(structuredClone(s),context({missionId:'m'}));assert.deepEqual(replay,p);
 });
}

test('legacy receipt does not manufacture a result-bound acceptance or cue',()=>{
 const s=accepted();s.missions[0].acceptance={legacy:true,actor:'captain',attemptId:'a',reviewedRevision:3,criteria:[true]};delete s.missions[0].selectedResult;
 const p=project(s,context({missionId:'m'}));assert.equal(p.state,'review');assert.equal(p.working,false);assert.match(p.label,/historical/i);assert.equal(p.acceptanceId,undefined);assert.equal(p.result,undefined);
});

test('malformed, mismatched or unbound acceptance never yields accepted state or cue',()=>{
 const mutations=[m=>m.acceptance.attemptId='other',m=>m.acceptance.resultId='other',m=>m.acceptance.resultSha256='b'.repeat(64),m=>m.acceptance.criteria=[false],m=>m.acceptance.actor='agent',m=>m.acceptance.reviewedRevision=99,m=>m.acceptance.id='',m=>m.acceptance.acceptedAt=NaN,m=>m.selectedResult.attemptId='other',m=>m.selectedResult.producerTaskId='other',m=>m.selectedResult.ref.taskId='other',m=>m.selectedResult.ref.sha256='bad',m=>delete m.selectedResult];
 for(const mutate of mutations){const s=accepted();mutate(s.missions[0]);const p=project(s,context({missionId:'m'}));assert.notEqual(p.state,'accepted');assert.equal(p.working,false);assert.equal(p.acceptanceId,undefined);}
});

test('accepted result requires main-held unique available reply and current artifact status',()=>{
 for(const unavailable of ['Reply removed','Duplicate reply IDs','Wrong reply role','Blank reply','Changed full reply hash']){
  const s=accepted();s.resultStatuses.m.status={...s.resultStatuses.m.status,available:false,unavailable};const p=project(s,context({missionId:'m'}));assert.notEqual(p.state,'accepted');assert.equal(p.acceptanceId,undefined);
 }
 const external=accepted();external.tasks[0].external=true;assert.notEqual(project(external,context({missionId:'m'})).state,'accepted');
 for(const change of [{projectId:'other'},{attemptId:'other'},{kind:'check'},{sha256:'c'.repeat(64)}]){const s=accepted('deliverable');Object.assign(s.missions[0].artifacts[0],change);assert.notEqual(project(s,context({missionId:'m'})).state,'accepted');}
});
test('unknown or stale main result status withholds accepted projection and cue despite saved receipt',()=>{
 for(const mutate of [s=>delete s.resultStatuses,s=>s.resultStatuses.m.state='loading',s=>s.resultStatuses.m.state='error',s=>s.resultStatuses.m.status.epoch='old',s=>s.tasks[0].transcriptRevision++]){
  const s=accepted();mutate(s);const p=project(s,context({missionId:'m'}));assert.notEqual(p.state,'accepted');assert.equal(p.acceptanceId,undefined);
 }
});
test('pending acceptance receipt cannot retain previous available result or accepted cue',()=>{
 const s=accepted();s.missions[0].acceptancePending=true;const p=project(s,context({missionId:'m'}));assert.notEqual(p.state,'accepted');assert.equal(p.acceptanceId,undefined);assert.match(p.label,/pending|recovery/i);
});

test('approval or uncertainty prevents even a saved receipt from showing accepted',()=>{
 const s=accepted();s.approvals=[approval()];let p=project(s,context({missionId:'m'}));assert.equal(p.state,'approval');assert.equal(p.working,false);assert.equal(p.acceptanceId,undefined);
 s.approvals=[];s.tasks[0].status='unknown';p=project(s,context({missionId:'m'}));assert.equal(p.state,'unknown');assert.equal(p.acceptanceId,undefined);
});

test('projection is pure and reduced motion or a seen cue never changes authoritative work state',()=>{
 const s=accepted();s.settings.reducedMotion=true;s.workspace.seenAcceptanceIds=['receipt'];const before=structuredClone(s);const c=context({missionId:'m'});const beforeContext=structuredClone(c);
 const p=project(s,c);assert.equal(p.state,'accepted');assert.equal(p.acceptanceId,'receipt');assert.deepEqual(s,before);assert.deepEqual(c,beforeContext);
 const working=snapshot({settings:{reducedMotion:true,notifications:false}});assert.equal(project(working,context({taskId:'root'})).working,true);
});

test('external history cannot supply authoritative live crew motion',()=>{
 const s=snapshot({tasks:[task('imported','working',{external:true})]});const p=project(s,context({taskId:'imported'}));assert.equal(p.state,'unknown');assert.equal(p.working,false);assert.match(p.label,/read.only|unavailable/i);
});

test('unfinished attempt with a failed or stopped sibling cannot animate another builder',()=>{
 for(const [status,state] of [['failed','failed'],['interrupted','stopped']]){
  const s=coordinated();s.tasks.find(t=>t.id==='plan').status=status;const p=project(s,context({missionId:'m'}));assert.equal(p.state,state);assert.equal(p.working,false);
 }
});

test('a historical selected task cannot borrow current task-family work when attempt membership is missing',()=>{
 const s=snapshot({missions:[mission({taskIds:['root','unbound']})],tasks:[task(),task('unbound','working')]});
 const p=project(s,context({taskId:'unbound'}));assert.equal(p.state,'unknown');assert.equal(p.working,false);assert.equal(p.taskId,'unbound');
});

test('inconsistent workflow completion cannot invent an active owner',()=>{
 const s=coordinated();s.missions[0].attempts[0].workflow.stages.forEach(stage=>{stage.status='complete';delete stage.taskId;});
 const p=project(s,context({missionId:'m'}));assert.equal(p.state,'unknown');assert.equal(p.working,false);
});

test('malformed snapshot or context stays unavailable without throwing or selecting work',()=>{
 for(const [s,c] of [[null,context()],[snapshot(),null],[snapshot({approvals:{}}),context({taskId:'root'})],[snapshot({tasks:[null]}),context({taskId:'root'})],[snapshot({projects:[null]}),context()]]){
  const p=project(s,c);assert.equal(p.state,'unknown');assert.equal(p.working,false);
 }
});

test('completed workflow stages wait for the coordinator turn rather than declaring mission review',()=>{
 const s=coordinated('review');const a=s.missions[0].attempts[0];a.workflow.complete=true;a.workflow.stages.at(-1).status='complete';s.tasks.find(t=>t.id==='review').status='finished';
 const p=project(s,context({missionId:'m'}));assert.equal(p.state,'waiting');assert.equal(p.working,false);assert.match(p.label,/coordinator/i);
 a.status='finished';s.tasks.find(t=>t.id==='root').status='finished';s.missions[0].status='WAITING_FOR_REVIEW';assert.equal(project(s,context({missionId:'m'})).state,'review');
});

test('explicit missing stage result or unrecognized member status remains unknown',()=>{
 const s=coordinated();s.tasks.find(t=>t.id==='work').status='finished';s.missions[0].attempts[0].workflow.stages[1].status='result-missing';assert.equal(project(s,context({missionId:'m'})).state,'unknown');
 const other=coordinated();other.tasks.find(t=>t.id==='plan').status='unrecognized';const p=project(other,context({missionId:'m'}));assert.equal(p.state,'unknown');assert.equal(p.working,false);
});
