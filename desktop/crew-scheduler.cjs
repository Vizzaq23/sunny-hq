const {randomUUID}=require('node:crypto');
const {readyAssignments,live}=require('./assignment-graph.cjs');
const {reviewAssignment}=require('./crew-registry.cjs');
const resolution=require('./conflict-resolution.cjs');
const phaseAllows=(run,a)=>(!run.ordinary||!reviewAssignment(a)||require('./mission-context.cjs').currentReview(run,a.reviewBinding))&&resolution.assignmentAllowed(run,a)&&(['waiting','executing','repairing'].includes(run.phase)||run.phase==='reviewing'&&reviewAssignment(a)||run.phase==='blocked'&&resolution.binding(run,a));
class CrewScheduler {
 constructor(deps){this.deps=deps;this.pending=new Map();this.closed=false;}
 quiesce(){this.closed=true;for(const entry of this.pending.values())entry.rerun=false;}
 async idle(){await Promise.allSettled([...this.pending.values()].map(entry=>entry.promise));}
 pump(runId){if(this.closed)return Promise.resolve();const current=this.pending.get(runId);if(current){current.rerun=true;return current.promise;}const entry={rerun:false,promise:null};entry.promise=Promise.resolve().then(async()=>{do{entry.rerun=false;await this.drain(runId);}while(entry.rerun&&!this.closed);}).finally(()=>this.pending.delete(runId));this.pending.set(runId,entry);return entry.promise;}
 async drain(runId){const d=this.deps;let run=d.getRun(runId);if(this.closed||!run||!['waiting','executing','repairing','reviewing','blocked'].includes(run.phase)||run.stopIntent||run.controlIntent?.state==='pending'||run.blockers?.length||require('./repair-policy.cjs').repairExhausted(run)&&!resolution.entitled(run)&&!resolution.completed(run))return;
  if(d.queueImprovement&&!resolution.pending(run).length&&!require('./repair-policy.cjs').repairExhausted(run)){await d.queueImprovement(runId);run=d.getRun(runId);if(this.closed||!run||run.stopIntent||run.controlIntent?.state==='pending')return;}
  const starts=[];
  for(const candidate of readyAssignments(run,d.state?.()||{})){
   run=d.getRun(runId);if(this.closed||!run||run.stopIntent||run.controlIntent?.state==='pending'||!['waiting','executing','repairing','reviewing','blocked'].includes(run.phase))break;
   if(!phaseAllows(run,candidate))continue;
   if(run.assignments.filter(live).length>=run.grant.maxWorkers||d.capacity().available<=0)break;
   const reservation=randomUUID();let reserved=false;
   try{d.assertLaunch(run,candidate);await d.prepare(candidate,run);if(this.closed)throw Error('Scheduler quiescing');run=d.getRun(runId);d.assertLaunch(run,candidate);
    await d.durableCommit(current=>{d.assertLaunch(current,candidate);const a=current.assignments.find(a=>a.id===candidate.id);if(!phaseAllows(current,a)||!readyAssignments(current,d.state?.()||{}).some(v=>v.id===a.id)||d.capacity().available<=0||current.assignments.filter(live).length>=current.grant.maxWorkers)throw Error('Assignment admission changed');a.launchReservationId=reservation;a.state='reserved';if(a.improvementTriggerId){const t=current.improvementTriggers.find(t=>t.id===a.improvementTriggerId);if(t.state!=='queued'||t.assignmentId!==a.id)throw Error('Improvement already consumed');t.state='consumed';}if(current.phase!=='reviewing'&&!resolution.pending(current).length)current.phase='executing';},runId);reserved=true;
    run=d.getRun(runId);const a=run.assignments.find(a=>a.id===candidate.id);d.assertLaunch(run,a);const start=Promise.resolve().then(()=>{const current=d.getRun(runId);if(this.closed||current.controlIntent?.state==='pending'||!phaseAllows(current,a))throw Error('Assignment phase changed before dispatch');d.assertLaunch(current,a);return d.start(a,current);}).catch(async error=>{await d.durableCommit(current=>{const a=current.assignments.find(a=>a.id===candidate.id);if(a.launchReservationId===reservation&&!['finished','failed','interrupted','cancelled'].includes(a.state))a.state='unknown';},runId);await d.onAdmissionError?.(runId,candidate.id,error);d.onError?.(error);});if(run.ordinary)await start;else starts.push(start);
   }catch(error){if(!reserved&&error.code==='ASSIGNMENT_CAPACITY_PENDING')break;if(reserved)await d.durableCommit(current=>{const a=current.assignments.find(a=>a.id===candidate.id);if(a.launchReservationId===reservation&&!['finished','failed','interrupted','cancelled'].includes(a.state))a.state='unknown';},runId);await d.onAdmissionError?.(runId,candidate.id,error);d.onError?.(error);}
  }
  await Promise.all(starts);
 }
 async outcome(task){const d=this.deps;if(!task.runId)return;const captured=task.status==='finished'?await d.captureOutcome?.(task):undefined;await d.durableCommit(run=>{const a=run.assignments.find(a=>a.id===task.assignmentId);if(!a||a.taskId!==task.id||a.workspaceId!==task.workspaceId||run.assignments.some(other=>other.ownershipTransfers?.some(t=>t.fromAssignmentId===a.id)||other.resolutionOwnership?.fromAssignmentId===a.id))throw Error('Stale assignment outcome');if(['finished','failed','interrupted','unknown'].includes(task.status))a.state=task.status;if(captured){a.sourceResult=structuredClone(captured);if(!a.improvementTriggerId){const next=require('./improvement-queue.cjs').queueImprovement(run,{triggerId:'completion:'+task.id,kind:'completed_result',evidenceRef:{sourceId:task.id,revision:captured.headCommit+':'+captured.fingerprint,baseCommit:captured.headCommit,time:d.clock?.()||Date.now()}});run.improvementTriggers=next.improvementTriggers;}}},task.runId,captured?{validate:()=>d.validateOutcome(task,captured)}:{});}
}
module.exports={CrewScheduler};
