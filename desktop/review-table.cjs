const {selection}=require('./handoff-parcels.cjs');
const {sameSource}=require('./review-verdicts.cjs');
const list=value=>Array.isArray(value)?value:[];
const bounded=(value,max=2000)=>typeof value==='string'?value.slice(0,max):null;
function query(state,args){
 const {mission,attempt,run}=selection(state,args),selected=mission.selectedResult;
 const verification=run?.verification;
 const bound=Boolean(selected&&selected.attemptId===attempt.id&&verification?.resultId===selected.id&&verification.resultSha256===selected.ref.sha256);
 const captain=list(mission.reviewDecisions).filter(d=>d.attemptId===attempt.id).at(-1);
 const source=bound?verification.source:null;
 const rows=list(mission.acceptanceCriteria).slice(0,100).map((criterion,index)=>{
  const matches=list(run?.criteria).filter(c=>c.text===criterion),criterionId=matches.length===1?matches[0].id:null;
  const checks=criterionId&&bound?list(verification.checks).filter(c=>c.criterionId===criterionId):[];
  const reviews=criterionId&&run?list(run.reviews).filter(review=>{
   const task=state.tasks.find(t=>t.id===review.reviewerTaskId&&t.projectId===mission.projectId&&t.runId===run.id);
   return task&&(attempt.taskIds.includes(task.id)||attempt.taskIds.includes(task.parentTaskId))&&list(review.criteriaIds??run.assignments.find(a=>a.id===review.assignmentId)?.criteriaIds).includes(criterionId);
  }):[];
  return {index,criterion:bounded(criterion,2000),criterionId,
   checks:checks.slice(0,16).map(c=>({id:c.id,kind:c.kind,status:c.status,sourceMatches:sameSource(c.source,source),commit:bounded(c.source?.headCommit,200),evidenceRef:bounded(c.evidenceRef),justification:bounded(c.justification)})),
   reviews:reviews.slice(0,16).map(r=>{const findings=list(r.findings).filter(f=>f.criterionId===criterionId);return {id:r.id,taskId:r.reviewerTaskId,decision:r.decision,sourceMatches:bound&&sameSource(r.source,source),time:r.time,findings:findings.slice(0,16).map(f=>({id:f.id,severity:f.severity,status:f.status,text:bounded(f.evidenceRef),path:bounded(f.path,4096)})),limited:findings.length>16};}),
   captain:captain?{id:captain.id,decision:captain.decision,confirmed:captain.decision==='accepted'&&captain.criteria?.[index]===true,note:bounded(captain.note),time:captain.time,reviewedRevision:captain.reviewedRevision}:null,
   limited:checks.length>16||reviews.length>16};
 });
 return {projectId:mission.projectId,missionId:mission.id,attemptId:attempt.id,revision:mission.revision,historical:attempt.id!==mission.activeAttemptId,resultId:selected?.attemptId===attempt.id?selected.id:null,resultSha256:selected?.attemptId===attempt.id?selected.ref.sha256:null,source:source?{commit:bounded(source.headCommit,200),fingerprint:bounded(source.fingerprint,200)}:null,evidenceBound:bound,rows,limited:list(mission.acceptanceCriteria).length>100};
}
module.exports={query};
