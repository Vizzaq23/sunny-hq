const {randomUUID}=require('node:crypto');
function sameHead(current,expected){if(current.url!==expected.url||current.commit!==expected.commit||current.fingerprint!==expected.fingerprint||current.baseBranch!==expected.baseBranch)throw Error('The reviewed PR changed. Inspect its latest source and prepare a new approval.');}
function mergeable(pr){if(pr.state!=='OPEN'||pr.isDraft||pr.checkStatus!=='passed'||['CHANGES_REQUESTED','REVIEW_REQUIRED'].includes(pr.reviewDecision))throw Error('Merge review requires an open, nondraft PR with passing checks and no outstanding review requirement.');}
class MissionMerge{
 constructor(hub){this.hub=hub;}
 async act(input,mode){
  const hub=this.hub;hub.validateMissionAction(input,mode==='submit'?['missionId','revision','requestId','confirmed']:['missionId','revision']);
  // GitHub's public merge API cannot atomically bind the approved target branch.
  // Never issue a mutation that could merge into a concurrently retargeted base.
  if(mode==='submit')throw Error('Approve the merge in GitHub, then recheck it here. Sunny cannot atomically bind the target branch through the available API.');
  const mission=hub.missionBook.get(input.missionId);hub.missionBook.check(mission,input.revision);
  if(mission.status!=='WAITING_FOR_REVIEW')throw Error('Finish and review the mission attempt first.');
  if(hub.missionActions.has(mission.id)||['publishing','uncertain'].includes(mission.prPublication?.state))throw Error('Finish or reconcile the current mission action first.');
  const project=hub.project(mission.projectId),lock='mission-merge:'+mission.id;hub.gate.acquire(lock,project.path);hub.missionActions.add(mission.id);
  try{
   if(mode==='prepare'){
    if(['submitting','uncertain'].includes(mission.mergeRequest?.state))throw Error('Reconcile the existing merge request first.');
    const prior=mission.artifacts.findLast(a=>a.kind==='pull-request'&&a.attemptId===mission.activeAttemptId);if(!prior)throw Error('Inspect the pull request before preparing merge review.');
    const fresh=await hub.pullRequests.inspect(project.path,prior.number);sameHead(fresh,prior);mergeable(fresh);
    return hub.missionMutation(()=>{hub.missionBook.check(mission,input.revision);mission.mergeRequest={...fresh,id:randomUUID(),attemptId:mission.activeAttemptId,state:'prepared',method:'approve in GitHub',expiresAt:Date.now()+5*60*1000};hub.missionBook.record(mission,'MERGE_REVIEW_PREPARED',{requestId:mission.mergeRequest.id});return mission.mergeRequest;});
   }
   const request=mission.mergeRequest;if(!request||request.attemptId!==mission.activeAttemptId)throw Error('Prepare merge review for this attempt first.');
   const fresh=await hub.pullRequests.inspect(project.path,request.number);
   if(fresh.url!==request.url||fresh.number!==request.number||fresh.repository!==request.repository)throw Error('The reviewed PR identity changed.');
   if(!['OPEN','CLOSED','MERGED'].includes(fresh.state))throw Error('GitHub did not report a known PR state.');
   if(fresh.state==='MERGED')sameHead(fresh,request);
   if(fresh.state==='MERGED'&&!Number.isFinite(Date.parse(fresh.mergedAt)))throw Error('Merge timestamp could not be verified.');
   return hub.missionMutation(()=>{hub.missionBook.check(mission,input.revision);request.state=fresh.state==='MERGED'?'merged':fresh.state==='CLOSED'?'closed':'open';request.verifiedAt=Date.now();const artifact={...fresh,id:randomUUID(),attemptId:mission.activeAttemptId,projectId:project.id,producer:'sunny-local-verifier'};mission.artifacts.push(artifact);hub.missionBook.record(mission,fresh.state==='MERGED'?'MERGE_VERIFIED':'MERGE_NOT_OBSERVED',{requestId:request.id,artifactId:artifact.id});return request;});
  }finally{hub.gate.release(lock);hub.missionActions.delete(mission.id);}
 }
}
module.exports={MissionMerge};
