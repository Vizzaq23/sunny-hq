import type {Mission,MissionArtifact} from './shared';
export function projectEvidence(missions:Mission[],projectId:string){
 return missions.filter(m=>m.projectId===projectId).map(mission=>{
  const artifacts=mission.artifacts.filter(a=>a.attemptId===mission.activeAttemptId);
  const latest=new Map<string,MissionArtifact>();for(const a of artifacts)if(a.kind==='check'&&a.script)latest.set(a.script,a);
  const source=artifacts.filter(a=>a.fingerprint).at(-1);
  const checks=[...latest.values()].map(a=>({...a,status:a.status==='passed'&&source&&a.fingerprint!==source.fingerprint?'stale' as const:a.status}));
  const deliverables=artifacts.filter(a=>a.kind==='deliverable');
  const deployment=artifacts.filter(a=>a.kind==='deployment').at(-1);
  const recordedSource=artifacts.filter(a=>a.commit).at(-1);
  const deploymentOlderSource=Boolean(deployment&&recordedSource&&recordedSource.commit!==deployment.commit);
  const pr=artifacts.filter(a=>a.kind==='pull-request').at(-1);
  const nextAction=mission.connection==='reconciling'?'Reconcile the connection':['publishing','uncertain'].includes(mission.prPublication?.state??'')?'Reconcile publication':['submitting','uncertain'].includes(mission.mergeRequest?.state??'')?'Recheck merge outcome':mission.status==='DRAFT'?'Prepare the mission':mission.status==='NEEDS_USER'?'Review crew request':['FAILED','BLOCKED','CANCELLED'].includes(mission.status)?'Inspect stopped work':mission.status==='RUNNING'?'Follow crew progress':checks.some(a=>a.status==='failed')?'Inspect failed checks':checks.some(a=>a.status==='stale')?'Rerun checks for the inspected source':deploymentOlderSource?'Recheck deployment evidence':deployment?.deployments?.some(d=>['failure','error'].includes(d.state))?'Inspect deployment failure':mission.status==='COMPLETE'?'Inspect accepted result':!checks.length?(deliverables.length?'Review written deliverables and criteria':'Collect check evidence'):'Review result and acceptance criteria';
  return {mission,checks,pr,deliverables,deployment,deploymentOlderSource,nextAction};
 });
}
