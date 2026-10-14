const {randomUUID}=require('node:crypto');
const LIVE=new Set(['starting','working','waiting','unknown']);
const TERMINAL=new Set(['finished','failed','interrupted']);
function text(value,label,max=10000){
 if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))throw Error('Invalid '+label+'.');
 return value.trim();
}
class MissionBook {
 constructor(saved){
  if(saved!==undefined&&(saved?.version!==1||!Array.isArray(saved.missions)))throw Error('Unsupported mission data version. Preserve the saved data and use a compatible Sunny version.');
  this.data=saved===undefined?{version:1,missions:[]}:structuredClone(saved);
  for(const mission of this.data.missions){
   if(!mission.id||!Array.isArray(mission.attempts)||!Array.isArray(mission.events)||!Array.isArray(mission.acceptanceCriteria)||!Number.isInteger(mission.revision))throw Error('Invalid saved mission data. Restore a verified backup.');
   const check=mission.checkExecution;if(check&&(typeof check.id!=='string'||!check.id||!['test','build','typecheck','lint'].includes(check.script)||!Number.isFinite(check.startedAt)||!mission.attempts.some(a=>a.id===check.attemptId)))throw Error('Invalid saved check reservation. Preserve the profile for recovery.');
   if(mission.seenEventIds!==undefined&&(!Array.isArray(mission.seenEventIds)||mission.seenEventIds.length>500||mission.seenEventIds.some(id=>typeof id!=='string'||!mission.events.some(event=>event.id===id))))throw Error('Invalid saved signal receipts.');
   if(mission.reviewDecisions!==undefined&&(!Array.isArray(mission.reviewDecisions)||mission.reviewDecisions.some(review=>!review||typeof review.id!=='string'||!mission.attempts.some(attempt=>attempt.id===review.attemptId)||!['accepted','changes-requested'].includes(review.decision)||review.actor!=='captain'||!Number.isFinite(review.time)||!Number.isSafeInteger(review.reviewedRevision)||review.reviewedRevision<1||review.reviewedRevision>mission.revision||review.decision==='changes-requested'&&(typeof review.note!=='string'||!review.note.trim()||review.note.length>4000)||review.decision==='accepted'&&(!Array.isArray(review.criteria)||review.criteria.length!==mission.acceptanceCriteria.length||!review.criteria.every(value=>value===true)))))throw Error('Invalid saved mission review decisions. Preserve the profile for recovery.');
  }
 }
 get(id){const mission=this.data.missions.find(m=>m.id===id);if(!mission)throw Error('Mission not found.');return mission;}
 recover(tasks){
  let changed=false;
  for(const mission of this.data.missions){const attempt=mission.attempts.at(-1);
   // Hub checkpoints the task before any provider submission. A saved reservation
   // with no task therefore means launch stopped before it could be dispatched.
   if(attempt?.status==='starting'&&!tasks.some(task=>task.id===attempt.taskId)){
    this.launchFailed(mission.id,attempt.id,'Launch stopped before its task was recorded. Provider work was not submitted.');changed=true;
   }
  }
  return this.sync(tasks,[])||changed;
 }
 check(mission,revision){if(mission.revision!==revision)throw Error('Mission changed. Review its latest revision before continuing.');}
 record(mission,type,detail={}){
  mission.revision++;mission.updatedAt=Date.now();
  mission.events.push({id:randomUUID(),schemaVersion:1,sequence:mission.revision,missionId:mission.id,projectId:mission.projectId,attemptId:mission.activeAttemptId||null,type,time:mission.updatedAt,...detail});
  if(mission.events.length>500)mission.events.splice(0,mission.events.length-500);
  if(mission.seenEventIds)mission.seenEventIds=mission.seenEventIds.filter(id=>mission.events.some(event=>event.id===id));
 }
 create(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid mission brief.');
  if(Object.keys(input).some(k=>!['projectId','title','objective','acceptanceCriteria','completionBoundary'].includes(k)))throw Error('Unknown mission field.');
  if(!Array.isArray(input.acceptanceCriteria)||!input.acceptanceCriteria.length||input.acceptanceCriteria.length>20)throw Error('Provide 1–20 acceptance criteria.');
  const completionBoundary=input.completionBoundary||'review';
  if(!['review','merge'].includes(completionBoundary))throw Error('Choose review or merge as the completion boundary.');
  const mission={id:randomUUID(),projectId:text(input.projectId,'project',200),title:text(input.title,'title',200),objective:text(input.objective,'objective',100000),acceptanceCriteria:input.acceptanceCriteria.map(c=>text(c,'acceptance criteria',2000)),completionBoundary,status:'DRAFT',connection:'connected',revision:0,createdAt:Date.now(),updatedAt:Date.now(),taskIds:[],attempts:[],artifacts:[],events:[]};
  this.record(mission,'MISSION_CREATED');this.data.missions.unshift(mission);return mission;
 }
 markSignalSeen(id,revision,eventId){
  const mission=this.get(id);this.check(mission,revision);
  if(typeof eventId!=='string'||!mission.events.some(event=>event.id===eventId))throw Error('Signal not found in this mission.');
  if(mission.seenEventIds?.includes(eventId))return mission;
  (mission.seenEventIds??=[]).push(eventId);mission.revision++;
  return mission;
 }
 begin(id,revision){
  const mission=this.get(id);this.check(mission,revision);
  if(!['DRAFT','FAILED','CANCELLED','WAITING_FOR_REVIEW','BLOCKED'].includes(mission.status))throw Error('Mission is running, active, or already complete.');
  if(mission.checkExecution)throw Error('Reconcile the unresolved project check before retrying.');
  const prior=mission.attempts.at(-1);
  if(prior&&!TERMINAL.has(prior.status))throw Error('Reconcile the active attempt before retrying.');
  if(['submitting','uncertain'].includes(mission.mergeRequest?.state))throw Error('Reconcile the merge request before retrying.');
  if(['publishing','uncertain'].includes(mission.prPublication?.state))throw Error('Reconcile the PR publication before retrying.');
  const attempt={id:randomUUID(),taskId:randomUUID(),status:'starting',startedAt:Date.now(),taskIds:[]};
  if(mission.mergeRequest){(mission.mergeHistory??=[]).push(mission.mergeRequest);mission.mergeRequest=undefined;}
  if(mission.prPublication){(mission.publicationHistory??=[]).push(mission.prPublication);mission.prPublication=undefined;}
  mission.attempts.push(attempt);mission.activeAttemptId=attempt.id;mission.status='RUNNING';mission.connection='connected';mission.acceptedAt=undefined;mission.acceptance=undefined;
  mission.taskIds.push(attempt.taskId);attempt.taskIds.push(attempt.taskId);
  this.record(mission,'MISSION_STARTED',{taskId:attempt.taskId});return attempt;
 }
 launchFailed(id,attemptId,error){
  const mission=this.get(id),attempt=mission.attempts.find(a=>a.id===attemptId);
  if(mission.activeAttemptId!==attemptId||!attempt||TERMINAL.has(attempt.status))return;
  attempt.status='failed';attempt.error=String(error).slice(0,2000);attempt.completedAt=Date.now();mission.status='FAILED';
  this.record(mission,'MISSION_FAILED',{reason:attempt.error});
 }
 sync(tasks,approvals){
  let changed=false;
  for(const mission of this.data.missions){
   const attempt=mission.attempts.at(-1);
   if(!attempt||TERMINAL.has(attempt.status)||mission.status==='COMPLETE')continue;
   const root=tasks.find(t=>t.id===attempt.taskId);if(!root)continue;
   const members=[root],seen=new Set([root.id]);
   for(let i=0;i<members.length;i++)for(const task of tasks)if(task.parentTaskId===members[i].id&&!seen.has(task.id)){members.push(task);seen.add(task.id);}
   const added=members.filter(t=>!attempt.taskIds.includes(t.id));
   for(const task of added){attempt.taskIds.push(task.id);if(!mission.taskIds.includes(task.id))mission.taskIds.push(task.id);this.record(mission,'TASK_ASSIGNED',{taskId:task.id,crewId:task.crewId});changed=true;}
   if(attempt.workflowVersion===1){const progress=require('./mission-workflow.cjs').stageProgress(attempt,tasks);if(JSON.stringify(attempt.workflow)!==JSON.stringify(progress)){attempt.workflow=progress;this.record(mission,'WORKFLOW_UPDATED',{stages:progress.stages});changed=true;}}
   const uncertain=members.some(t=>t.status==='unknown');
   const live=members.some(t=>LIVE.has(t.status));
   const needsUser=approvals.some(a=>seen.has(a.taskId));
   const failure=members.find(t=>t.status==='failed');
   const cancelled=members.some(t=>t.status==='interrupted');
   let status=needsUser?'NEEDS_USER':'RUNNING',attemptStatus=uncertain?'unknown':needsUser?'waiting':'working';
   if(!live){
    if(failure){status='FAILED';attemptStatus='failed';}
    else if(cancelled){status='CANCELLED';attemptStatus='interrupted';}
    else if(members.every(t=>t.status==='finished')){if(attempt.workflowVersion===1&&!attempt.workflow?.complete){status='FAILED';attemptStatus='failed';attempt.error='Coordinator ended before the '+attempt.workflow.stages.find(s=>s.status!=='complete').id+' stage produced a result. Start a new attempt to continue.';}else{status='WAITING_FOR_REVIEW';attemptStatus='finished';}}
    else {status='BLOCKED';attemptStatus='unknown';}
   }
   const connection=uncertain||attemptStatus==='unknown'?'reconciling':'connected';
   if(status===mission.status&&attemptStatus===attempt.status&&connection===mission.connection)continue;
   mission.status=status;mission.connection=connection;attempt.status=attemptStatus;
   if(TERMINAL.has(attemptStatus)){attempt.completedAt=Date.now();if(failure)attempt.error=String(failure.error||'A crew task failed.').slice(0,2000);}
   const event=needsUser?'APPROVAL_REQUESTED':connection==='reconciling'?'CONNECTION_UNCERTAIN':status==='FAILED'?'MISSION_FAILED':status==='CANCELLED'?'ATTEMPT_CANCELLED':status==='WAITING_FOR_REVIEW'?'REVIEW_STARTED':'AGENT_WORKING';
   this.record(mission,event,{taskId:root.id,status});changed=true;
  }
  return changed;
 }
 accept(id,revision,criteria,mergedProof){
  const mission=this.get(id);this.check(mission,revision);
  if(mission.status!=='WAITING_FOR_REVIEW')throw Error('Mission is not ready for review.');
  if(mission.checkExecution)throw Error('Resolve the project check before acceptance.');
  if(!Array.isArray(criteria)||criteria.length!==mission.acceptanceCriteria.length||!criteria.every(value=>value===true))throw Error('Confirm every acceptance criteria item after reviewing the evidence.');
  // Proof is supplied only by Hub after a fresh read, never by the renderer command.
  if(mission.completionBoundary==='merge'&&(!mergedProof||!mission.artifacts.includes(mergedProof)||mergedProof.attemptId!==mission.activeAttemptId||mergedProof.state!=='MERGED'||mergedProof.checkStatus!=='passed'))throw Error('Verify the merged pull request before completing this mission.');
  mission.status='COMPLETE';mission.acceptedAt=Date.now();mission.acceptance={attemptId:mission.activeAttemptId,criteria:[...criteria],reviewedRevision:revision,actor:'captain',...(mergedProof?{prArtifactId:mergedProof.id}:{})};
  (mission.reviewDecisions??=[]).push({id:randomUUID(),attemptId:mission.activeAttemptId,decision:'accepted',criteria:[...criteria],reviewedRevision:revision,time:mission.acceptedAt,actor:'captain'});
  this.record(mission,'MISSION_COMPLETE');return mission;
 }
 requestChanges(id,revision,note){
  const mission=this.get(id);this.check(mission,revision);const feedback=text(note,'requested changes note',4000);
  if(mission.status!=='WAITING_FOR_REVIEW')throw Error('Mission is not ready for review.');
  if(mission.checkExecution)throw Error('Resolve the pending check before requesting changes.');
  if(['publishing','uncertain'].includes(mission.prPublication?.state)||['submitting','uncertain'].includes(mission.mergeRequest?.state))throw Error('Reconcile the pending publication or merge before requesting changes.');
  (mission.reviewDecisions??=[]).push({id:randomUUID(),attemptId:mission.activeAttemptId,decision:'changes-requested',note:feedback,reviewedRevision:revision,time:Date.now(),actor:'captain'});
  mission.status='BLOCKED';this.record(mission,'CHANGES_REQUESTED',{note:feedback,actor:'captain'});return mission;
 }
}
module.exports={MissionBook};
