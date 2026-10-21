import type {Mission,Snapshot,TaskSummary} from './shared';

/** Only the selected task's current attempt can supply station evidence. */
export function roomEvidence(snapshot:Snapshot,task?:TaskSummary){
 const mission=task?(snapshot.missions??[]).find(value=>value.projectId===task.projectId&&value.taskIds.includes(task.id)):undefined;
 const attempt=mission?.attempts.find(value=>value.id===mission.activeAttemptId);
 const ownsAttempt=Boolean(task&&attempt&&(attempt.taskId===task.id||attempt.taskIds.includes(task.id)));
 const artifacts=ownsAttempt?mission!.artifacts.filter(value=>value.projectId===task!.projectId&&value.attemptId===attempt!.id):[];
 const run=task?.runId?(snapshot.runs??[]).find(value=>value.id===task.runId&&value.projectId===task.projectId):undefined;
 const approvals=task?snapshot.approvals.filter(value=>value.taskId===task.id):[];
 const checks=artifacts.filter(value=>value.kind==='check');
 const deliverables=artifacts.filter(value=>['deliverable','image','playable'].includes(value.kind));
 const criteria=mission?.acceptanceCriteria??run?.criteria?.map(value=>value.text)??[];
 const peers=task?snapshot.tasks.filter(value=>value.projectId===task.projectId&&value.id!==task.id&&(value.parentTaskId===task.id||task.parentTaskId&&value.parentTaskId===task.parentTaskId)):[];
 return {mission,attempt:ownsAttempt?attempt:undefined,artifacts,checks,deliverables,criteria,run,approvals,peers,review:ownsAttempt?currentReview(mission):undefined};
}
export function currentReview(mission?:Mission){
 return mission?.reviewDecisions?.filter(value=>value.attemptId===mission.activeAttemptId).at(-1);
}
