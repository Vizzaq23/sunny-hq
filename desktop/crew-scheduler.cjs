const {randomUUID}=require('node:crypto');
const {readyAssignments,live}=require('./assignment-graph.cjs');
class CrewScheduler {
 constructor(deps){this.deps=deps;this.pending=new Map();}
 pump(runId){if(this.pending.has(runId))return this.pending.get(runId);const promise=this.drain(runId).finally(()=>this.pending.delete(runId));this.pending.set(runId,promise);return promise;}
 async drain(runId){const d=this.deps;let run=d.getRun(runId);if(!run||!['waiting','executing','repairing'].includes(run.phase)||run.stopIntent||run.blockers?.length||require('./repair-policy.cjs').repairExhausted(run))return;
  const starts=[];
  for(const candidate of readyAssignments(run,d.state?.()||{})){
   run=d.getRun(runId);if(!run||run.stopIntent||!['waiting','executing','repairing'].includes(run.phase))return;
   if(run.assignments.filter(live).length>=run.grant.maxWorkers||d.capacity().available<=0)break;
   const reservation=randomUUID();let reserved=false;
   try{d.assertLaunch(run,candidate);await d.prepare(candidate,run);run=d.getRun(runId);d.assertLaunch(run,candidate);
    await d.durableCommit(current=>{d.assertLaunch(current,candidate);const a=current.assignments.find(a=>a.id===candidate.id);if(!readyAssignments(current,d.state?.()||{}).some(v=>v.id===a.id)||d.capacity().available<=0||current.assignments.filter(live).length>=current.grant.maxWorkers)throw Error('Assignment admission changed');a.launchReservationId=reservation;a.state='reserved';current.phase='executing';},runId);reserved=true;
    run=d.getRun(runId);const a=run.assignments.find(a=>a.id===candidate.id);d.assertLaunch(run,a);starts.push(Promise.resolve().then(()=>{const current=d.getRun(runId);d.assertLaunch(current,a);return d.start(a,current);}).catch(async error=>{await d.durableCommit(current=>{const a=current.assignments.find(a=>a.id===candidate.id);if(a.launchReservationId===reservation&&!['finished','failed','interrupted'].includes(a.state))a.state='unknown';},runId);d.onError?.(error);}));
   }catch(error){if(reserved)await d.durableCommit(current=>{const a=current.assignments.find(a=>a.id===candidate.id);if(a.launchReservationId===reservation&&!['finished','failed','interrupted'].includes(a.state))a.state='unknown';},runId);d.onError?.(error);}
  }
  await Promise.all(starts);
 }
 async outcome(task){const d=this.deps;if(!task.runId)return;const captured=task.status==='finished'?await d.captureOutcome?.(task):undefined;await d.durableCommit(run=>{const a=run.assignments.find(a=>a.id===task.assignmentId);if(!a||a.taskId!==task.id||a.workspaceId!==task.workspaceId||run.assignments.some(other=>other.ownershipTransfers?.some(t=>t.fromAssignmentId===a.id)))throw Error('Stale assignment outcome');if(['finished','failed','interrupted','unknown'].includes(task.status))a.state=task.status;if(captured)a.sourceResult=structuredClone(captured);},task.runId,captured?{validate:()=>d.validateOutcome(task,captured)}:{});}
}
module.exports={CrewScheduler};
