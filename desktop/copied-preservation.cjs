const {isDeepStrictEqual:same}=require('node:util');
const clone=value=>structuredClone(value),json=value=>JSON.parse(JSON.stringify(value));
const live=value=>['starting','working','waiting','unknown'].includes(value);
const terminal=value=>['finished','failed','interrupted'].includes(value);
const fail=()=>{throw Object.assign(Error('COPIED_STATE_CHANGED'),{code:'COPIED_STATE_CHANGED'});};
const need=value=>{if(!value)fail();};
const time=value=>Number.isSafeInteger(value)&&value>=0;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const intent=task=>Boolean(task.toolDispatchIntent||task.replacementThreadIntent||task.approvalResponseIntent&&task.approvalResponseIntent.state!=='submitted');
function workflow(attempt,tasks){
 const children=tasks.filter(t=>t.parentTaskId===attempt.taskId).sort((a,b)=>attempt.taskIds.indexOf(a.id)-attempt.taskIds.indexOf(b.id));let cursor=0,blocked=false;
 const roles=require('./mission-roles.cjs').ROLE_BINDINGS;
 const stages=[['plan',['planner']],['work',['builder','designer','researcher','diagnostician','creator','operator']],['validate',['validator']],['review',['reviewer']]].map(([id,allowed])=>{
  if(blocked)return {id,status:'pending'};const index=children.findIndex((t,i)=>i>=cursor&&allowed.includes(roles.find(r=>r.crewId===t.crewId)?.id)),task=children[index];
  if(!task){blocked=true;return {id,status:'pending'};}const output=task.messages?.findLast(m=>m.role==='assistant'&&typeof m.text==='string'&&m.text.trim()),done=task.status==='finished'&&Boolean(output);cursor=index+1;blocked=!done;
  return {id,taskId:task.id,status:done?'complete':task.status==='finished'?'result-missing':task.status,...(done?{resultMessageId:output.id}:{})};
 });return {stages,complete:stages.every(s=>s.status==='complete')};
}
// Reconstruct only specified recovery changes from the prior image. No Hub,
// MissionBook.recover, run-control recovery, or budget mutation is called here.
function missionImage(prior,actual,tasks){
 const m=clone(prior);let appended=0;
 const record=(type,detail={})=>{const e=actual.events[prior.events.length+appended++];need(e&&uuid(e.id)&&time(e.time)&&!prior.events.some(old=>old.id===e.id));m.revision++;m.updatedAt=e.time;const expected={id:e.id,schemaVersion:1,sequence:m.revision,missionId:m.id,projectId:m.projectId,attemptId:m.activeAttemptId||null,type,time:e.time,...detail};need(same(e,expected));m.events.push(expected);};
 const attempt=m.attempts.at(-1),root=tasks.find(t=>t.id===attempt?.taskId);
 if(attempt?.status==='starting'&&!root&&m.activeAttemptId===attempt.id){attempt.status='failed';attempt.error='Launch stopped before its task was recorded. Provider work was not submitted.';need(time(actual.attempts.at(-1).completedAt));attempt.completedAt=actual.attempts.at(-1).completedAt;m.status='FAILED';record('MISSION_FAILED',{reason:attempt.error});}
 if(attempt&&!terminal(attempt.status)&&m.status!=='COMPLETE'&&root){
  const members=[root],seen=new Set([root.id]);for(let i=0;i<members.length;i++)for(const task of tasks)if(task.parentTaskId===members[i].id&&!seen.has(task.id)){members.push(task);seen.add(task.id);}
  for(const task of members.filter(t=>!attempt.taskIds.includes(t.id))){attempt.taskIds.push(task.id);if(!m.taskIds.includes(task.id))m.taskIds.push(task.id);record('TASK_ASSIGNED',{taskId:task.id,crewId:task.crewId});}
  if(attempt.workflowVersion===1){const next=workflow(attempt,tasks);if(!same(json(attempt.workflow),next)){attempt.workflow=next;record('WORKFLOW_UPDATED',{stages:next.stages});}}
  const uncertain=members.some(t=>t.status==='unknown'),running=members.some(t=>live(t.status)),failure=members.find(t=>t.status==='failed');let status='RUNNING',attemptStatus=uncertain?'unknown':'working';
  if(!running){if(failure){status='FAILED';attemptStatus='failed';}else if(members.some(t=>t.status==='interrupted')){status='CANCELLED';attemptStatus='interrupted';}else if(members.every(t=>t.status==='finished')){if(attempt.workflowVersion===1&&!attempt.workflow.complete){status='FAILED';attemptStatus='failed';attempt.error='Coordinator ended before the '+attempt.workflow.stages.find(s=>s.status!=='complete').id+' stage produced a result. Start a new attempt to continue.';}else{status='WAITING_FOR_REVIEW';attemptStatus='finished';}}else{status='BLOCKED';attemptStatus='unknown';}}
  const connection=uncertain||attemptStatus==='unknown'?'reconciling':'connected';
  if(status!==m.status||attemptStatus!==attempt.status||connection!==m.connection){m.status=status;m.connection=connection;attempt.status=attemptStatus;if(terminal(attemptStatus)){need(time(actual.attempts.at(-1).completedAt));attempt.completedAt=actual.attempts.at(-1).completedAt;if(failure)attempt.error=String(failure.error||'A crew task failed.').slice(0,2000);}record(connection==='reconciling'?'CONNECTION_UNCERTAIN':status==='FAILED'?'MISSION_FAILED':status==='CANCELLED'?'ATTEMPT_CANCELLED':status==='WAITING_FOR_REVIEW'?'REVIEW_STARTED':'AGENT_WORKING',{taskId:root.id,status});}
 }
 if(m.status==='COMPLETE'&&m.acceptance?.legacy!==true&&!m.acceptanceRecovery&&actual.acceptanceRecovery){const a=m.acceptance;need(a&&time(actual.acceptanceRecovery.detectedAt));m.acceptanceRecovery={version:1,acceptanceId:a.id,resultId:a.resultId,resultSha256:a.resultSha256,reason:'result-binding',detectedAt:actual.acceptanceRecovery.detectedAt};record('ACCEPTANCE_RECOVERY_REQUIRED',{acceptanceId:a.id});}
 return m;
}
function runTasks(run,tasks,missions){
 const ids=new Set([run.coordinator?.taskId,run.coordinatorContinuation?.taskId,...(run.coordinatorHistory||[]).map(x=>x.taskId),...run.assignments.map(a=>a.taskId),...missions.filter(m=>m.runId===run.id).flatMap(m=>m.taskIds)].filter(Boolean));for(const task of tasks)if(task.runId===run.id)ids.add(task.id);
 for(let changed=true;changed;){changed=false;for(const task of tasks)if(ids.has(task.parentTaskId)&&!ids.has(task.id)){ids.add(task.id);changed=true;}}return tasks.filter(t=>ids.has(t.id));
}
function report(run,tasks,missions){
 const prior=run.controlReport||{},result={runId:run.id,revision:run.revision,queuedCancelled:clone(prior.queuedCancelled||[]),interruptionRequested:clone(prior.interruptionRequested||[]),confirmedStopped:[],unknownEffects:[],errors:clone(prior.errors||[])};
 const unknown=id=>{if(!result.unknownEffects.includes(id))result.unknownEffects.push(id);};
 for(const task of tasks){if(live(task.status)||intent(task))unknown('task:'+task.id);else result.confirmedStopped.push('task:'+task.id);}
 for(const a of run.assignments)if(['reserved','starting','working','waiting','unknown'].includes(a.state)&&!a.taskId)unknown('assignment:'+a.id);
 // Recovered controllers are installed in this fixed order before the report.
 for(const c of run.combinedChecks||[])if(c.state!=='completed')unknown('effect:'+c.id);
 for(const c of run.integrations||[])if(!require('./conflict-resolution.cjs').contribution(run,c))unknown('effect:'+c.id);
 for(const d of run.deliveries||[])for(const e of Object.values(d.playable?.effects||{}))if(e.state==='pending')unknown('effect:'+e.id);
 for(const e of run.ownedEffects||[])if(e.state!=='stopped')unknown('effect:'+e.id);
 for(const m of missions.filter(m=>m.runId===run.id))if(m.checkExecution||m.pendingAcceptance||m.acceptanceRecovery||m.branch?.state==='preparing'||['publishing','uncertain'].includes(m.prPublication?.state)||['submitting','uncertain'].includes(m.mergeRequest?.state))unknown('mission:'+m.id);
 for(const op of run.feedbackOperations||[])if(op.state==='unknown'||op.state==='dispatching'&&!tasks.some(t=>t.id===op.coordinatorTaskId))unknown('feedback:'+op.id);
 for(const d of run.deliveries||[])if(d.continuation?.state==='pending'&&!tasks.some(t=>t.id===d.continuation.taskId))unknown('continuation:'+d.continuation.id);
 for(const w of run.workspaces)if(['reserved','unknown','blocked'].includes(w.state))unknown('workspace:'+w.id);
 return result;
}
function runImage(prior,actual,allTasks,missions,samples){
 const r=clone(prior),tasks=runTasks(r,allTasks,missions);
 for(const op of r.feedbackOperations||[])if(['requested','prepared','dispatching'].includes(op.state)){op.state='unknown';op.reason='Recovered feedback never dispatches automatically';op.generation++;}
 const entitlement=r.completionEntitlement;if(entitlement&&!['revoked','completed'].includes(entitlement.stage)){entitlement.stage='revoked';entitlement.reason='RECOVERED_ENTITLEMENT_NOT_RESUMED';}
 for(const d of r.deliveries||[])if(!['completed','blocked','unknown'].includes(d.stage)){
  d.stage='unknown';d.reasonCode='RECOVERED_OPERATION_NOT_RESUMED';d.generation++;if(d.playable)d.playable.generation=d.generation;
  if(entitlement?.epochId===d.epochId){need(!entitlement.deliveryId||entitlement.deliveryId===d.id);entitlement.deliveryId=d.id;entitlement.deliveryGeneration=d.generation;entitlement.deliveryDigest=require('./mission-context.cjs').digest(d.playable||{id:d.id,generation:d.generation,graphDigest:d.graphDigest});if(d.playable){entitlement.deliveryBinding=clone(d.playable);if(d.playable.effects)entitlement.effects.production=Object.fromEntries(Object.entries(d.playable.effects).map(([kind,v])=>[kind,v.id]));if(d.playable.validationChecks)entitlement.effects.validation=clone(d.playable.validationChecks);}if(d.continuation){entitlement.validationTaskId=d.continuation.taskId;entitlement.continuationId=d.continuation.id;}}
 }
 for(const launch of r.playableLaunches||[])if(launch.cleanup!=='confirmed'){launch.state='unknown';launch.cleanup='unknown';r.ownedEffects??=[];if(!r.ownedEffects.some(e=>e.id===launch.id))r.ownedEffects.push({id:launch.id,runId:r.id,projectId:r.projectId,workspaceId:launch.workspaceId,kind:'launch',state:'unknown'});}
 if(!['paused','stopping','stopped','unknown'].includes(r.phase)&&!r.stopIntent){
  if(!r.controlIntent){const supplied=actual.controlIntent,policy=actual.stopIntent?.requestedBy==='policy'&&supplied?.action==='stop';need(policy||supplied&&uuid(supplied.id)&&time(supplied.time));
   // An independently verified budget stop replaces this transient pause in
   // the same initialization; its discarded random identity is not a receipt.
   r.controlIntent={id:policy?'discarded-recovery-pause':supplied.id,action:'pause',revision:r.revision,time:policy?0:supplied.time,state:'pending',resumePhase:r.phase};}
  const observed=report(r,tasks,missions);r.controlReport={...r.controlReport,...observed};if(!observed.unknownEffects.length){r.controlIntent.state='confirmed';r.phase='paused';}else r.phase='stopping';
 }
 if(samples||!same(prior.accounting,actual.accounting)||!same(prior.counters,actual.counters)){
  need(samples);
  for(const sample of samples){
   const next=sample.clock,tasksQuiet=tasks.every(t=>!live(t.status));
   const ownedBusy=(r.combinedChecks||[]).some(c=>c.state!=='completed')||(r.integrations||[]).some(c=>!require('./conflict-resolution.cjs').contribution(r,c))||(r.deliveries||[]).some(d=>Object.values(d.playable?.effects||{}).some(e=>e.state==='pending'))||(r.ownedEffects||[]).some(e=>e.state!=='stopped')||missions.some(m=>m.runId===r.id&&m.checkExecution),quiescent=!ownedBusy&&tasksQuiet;
   if(!r.accounting)r.accounting={usage:[],launchReservations:[],workers:[],clock:{...next,quiescent:tasksQuiet,uncertain:!tasksQuiet},warningAt:null,telemetryUncertain:false};
   const c=r.accounting.clock;
   if(c?.epoch&&c.epoch!==next.epoch)for(const w of r.accounting.workers)if(tasks.some(t=>t.executionId===w.id&&t.status==='unknown'))w.active=true;
   if(!(c?.quiescent&&quiescent&&next.wall>=c.wall)){
    let uncertain=c?.uncertain||false,delta=0;
    if(c){const wall=next.wall-c.wall;uncertain||=wall<0;delta=Math.max(0,wall);if(next.epoch===c.epoch&&c.monotonic!==undefined){const mono=next.monotonic-c.monotonic;uncertain||=mono<0;delta=Math.max(delta,Math.max(0,mono));}else if(!c.quiescent||!quiescent)uncertain=true;
     if(!c.quiescent||c.quiescent&&c.epoch&&c.epoch!==next.epoch&&!quiescent){r.counters.activeMs=Math.min(Number.MAX_SAFE_INTEGER,r.counters.activeMs+delta);if(r.accounting.workers.some(w=>w.active&&r.accounting.launchReservations.some(x=>x.id===w.id&&r.assignments.some(a=>a.id===x.assignmentId&&a.improvementTriggerId))))r.counters.improvementMs=Math.min(Number.MAX_SAFE_INTEGER,r.counters.improvementMs+delta);for(const w of r.accounting.workers)if(w.active)w.activeMs=Math.min(Number.MAX_SAFE_INTEGER,w.activeMs+delta);}
    }
    r.accounting.clock={wall:Math.max(next.wall,c?.wall||0),quiescent,uncertain,epoch:next.epoch,monotonic:next.monotonic};
   }
   for(const w of r.accounting.workers)w.active=Boolean(r.ownedEffects?.some(e=>e.id===w.id&&e.state!=='stopped')||tasks.some(t=>t.executionId===w.id&&live(t.status)));
  const g=r.grant,v=r.counters,warning=v.tokens>=g.tokenLimit*.8||v.activeMs>=g.activeMs*.8||v.launches>=g.maxLaunches*.8||r.accounting.workers.some(w=>w.active&&w.activeMs>=g.workerMs*.8);
  if(r.accounting.warningAt===null&&warning){need(time(next.wall));r.accounting.warningAt=next.wall;}
  // A policy stop is permitted only by the independently computed limit, with
  // its exact new revision, deterministic ID, bindings and complete receipts.
  const exhausted=r.repairExhausted===true||v.repairs>=Math.min(3,g.maxRepairs),allowance=require('./feedback-epochs.cjs').allows(r,{purpose:'accounting'})||require('./conflict-resolution.cjs').budgetAllowance(r,{purpose:'accounting'})||require('./mission-delivery.cjs').continuationAllowance(r,undefined);
  let reason=v.tokens>=g.tokenLimit?'Run token limit reached.':r.assignments.some(a=>a.improvementTriggerId&&['reserved','starting','working','waiting','unknown'].includes(a.state))&&(v.improvementTokens>=g.improvementTokens||v.improvementMs>=g.improvementMs)?'Improvement allowance limit reached.':v.activeMs>=g.activeMs?'Run active time limit reached.':v.launches>g.maxLaunches?'Run launch limit reached.':exhausted&&!allowance?'Run repair limit reached.':r.accounting.workers.some(w=>w.active&&w.activeMs>=g.workerMs)?'Worker time limit reached.':'';
  const workers=tasks.filter(t=>!t.captain&&!t.external&&live(t.status)),global=allTasks.filter(t=>!t.captain&&!t.external&&live(t.status));if(workers.length>g.maxWorkers)reason='Run worker limit reached.';else if(workers.length&&(global.length>(global.some(t=>t.status==='unknown'||!Number.isSafeInteger(t.tokenUsage?.total?.totalTokens))?1:3)||r.accounting.telemetryUncertain&&global.length>1))reason='Uncertain telemetry worker limit reached.';
  if(reason&&!r.stopIntent&&r.phase!=='stopped')policyStop(r,reason,tasks,next.wall);
  }
 }
 return r;
}
function policyStop(r,reason,tasks,wall){
 const revision=r.revision+1,id='run-'+require('node:crypto').createHash('sha256').update(JSON.stringify([r.id,revision])).digest('hex'),at=wall;need(time(at));
 r.revision=revision;r.stopIntent={id,requestedBy:'policy',reason,time:at,revision};r.phase=r.assignments.some(a=>['reserved','starting','working','waiting','unknown'].includes(a.state))||tasks.some(t=>live(t.status))?'stopping':'stopped';
 if(r.repairExhausted===true||r.counters.repairs>=Math.min(3,r.grant.maxRepairs)){r.repairExhausted=true;r.readiness=null;}
 if(r.completionEntitlement&&!['revoked','completed'].includes(r.completionEntitlement.stage)){r.completionEntitlement.stage='revoked';r.completionEntitlement.reason='CAPTAIN_CONTROL';}
 r.controlIntent={id,action:'stop',revision,time:at,state:'pending'};const queued=[];for(const a of r.assignments)if(['queued','reserved'].includes(a.state)&&!a.taskId){a.state='cancelled';queued.push('assignment:'+a.id);}
 r.controlReport={runId:r.id,revision,queuedCancelled:queued,interruptionRequested:[],confirmedStopped:[],unknownEffects:[],errors:[]};
 r.events??=[];r.blockers??=[];r.grantHistory??=[];r.coordinatorCalls??=[];r.disagreementRounds??=0;r.decisions.push({id,runId:r.id,revision,type:'stop',time:at,details:{},option:'stop',reason,dissent:[],owner:'captain',nextAction:'Confirm stopped work',reopenEvidence:'New captain instruction'});r.events.push({id,runId:r.id,revision,type:'stop',time:at,details:{}});
}
function assertPreserved(before,after,proof){
 try{
  const samples=proof?validateTrace(proof):undefined;
  if(same(json(before),json(after)))return [];
  const expected=clone(before),tasks=expected.tasks||[];for(const t of tasks){if(live(t.status))t.status='unknown';if(intent(t)){t.status='unknown';t.error||='Task effect outcome remains unresolved. Reconcile it before continuing.';}}
  expected.discussions=(expected.discussions||[]).map(d=>({...d,status:d.status==='working'?'interrupted':d.status}));
  expected.settings={reducedMotion:false,notifications:true,roomSoundEnabled:false,roomSoundVolume:.32,routingPolicy:'efficient',...expected.settings};
  if(expected.news===undefined)expected.news={version:1,captureMode:'manual',items:[],lastCaptureAt:null,lastOrigin:'',preferences:{roles:'',location:'',topics:''}};
  if(expected.world===undefined)expected.world={version:1,paused:true,maxConcurrentJobs:1,residents:require('./island-residents.json').map(r=>({...r,recruited:false})),jobs:[],ledger:[]};
  expected.world.paused=true;expected.world.jobs=(expected.world.jobs||[]).map(j=>['running','stopping'].includes(j.status)?{...j,status:'blocked',error:'App restarted. Reconcile the previous mission before running again.'}:j);
  if(expected.growth===undefined)expected.growth={version:1,enabled:true,profiles:Object.fromEntries(['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe',...require('./island-residents.json').map(r=>r.id)].map(id=>[id,{xp:0,conversations:0,memories:[],seen:[],relationships:{}}]))};
  expected.missionBook.missions=expected.missionBook.missions.map((m,i)=>missionImage(m,after.missionBook.missions[i],tasks));
  expected.missionBook.runs=expected.missionBook.runs.map((r,i)=>runImage(r,after.missionBook.runs[i],tasks,expected.missionBook.missions,samples));
  need(same(json(expected),json(after)));return [{path:'specified-recovery',before:before.missionBook.version,after:after.missionBook.version}];
 }catch{fail();}
}
function validateTrace(proof){
 need(proof&&Object.keys(proof).sort().join(',')==='nonceSha256,phase,trace');const {trace,nonceSha256,phase}=proof;
 need(trace&&Object.keys(trace).sort().join(',')==='nonceSha256,phase,samples,version'&&trace.version===1&&/^[a-f0-9]{64}$/.test(nonceSha256)&&trace.nonceSha256===nonceSha256&&['initial','reopen'].includes(phase)&&trace.phase===phase&&Array.isArray(trace.samples)&&trace.samples.length>=1&&trace.samples.length<=2);
 let prior;for(const [index,sample]of trace.samples.entries()){need(sample&&Object.keys(sample).sort().join(',')==='clock,stage'&&sample.stage===(index===0?'initialize':'close'));const clock=sample.clock;need(clock&&Object.keys(clock).sort().join(',')==='epoch,monotonic,wall'&&time(clock.wall)&&clock.wall<=Date.now()&&time(clock.monotonic)&&uuid(clock.epoch));if(prior)need(clock.epoch===prior.epoch&&clock.monotonic>=prior.monotonic);prior=clock;}
 return trace.samples;
}
module.exports={assertPreserved};
