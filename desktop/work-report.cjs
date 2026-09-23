const DAY=86400000;
const MAX_ITEMS=500;
const ATTENTION=new Set(['unknown','failed','interrupted','blocked','waiting-approval','review-needed','stale']);
const UNRESOLVED=new Set(['unknown','failed','interrupted','blocked','waiting-approval','review-needed','working']);

function validateScope(snapshot,scope={},now=Date.now()){
 if(!scope||typeof scope!=='object'||Array.isArray(scope)||Object.keys(scope).some(key=>!['projectIds','since','until'].includes(key)))throw Error('Invalid report scope.');
 const ids=scope.projectIds??snapshot.projects.map(project=>project.id);
 if(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string'||!snapshot.projects.some(project=>project.id===id)))throw Error('Choose registered projects.');
 const since=scope.since??now-7*DAY,until=scope.until??now;
 if(!Number.isFinite(since)||!Number.isFinite(until)||since>until||until>now+60000||until-since>365*DAY)throw Error('Choose a valid report period of at most one year.');
 return {projectIds:[...new Set(ids)],since,until};
}

function taskStatus(task){return task.status==='finished'?'review-needed':task.status==='waiting'?'waiting-approval':task.status;}
function missionStatus(mission){return {COMPLETE:'accepted',WAITING_FOR_REVIEW:'review-needed',NEEDS_USER:'waiting-approval',RUNNING:'working',BLOCKED:'blocked',FAILED:'failed',CANCELLED:'interrupted',DRAFT:'draft'}[mission.status]||'unknown';}
function boundedTitle(value){return typeof value==='string'?value.slice(0,180):'Untitled';}
function time(value,alternative){return Number.isFinite(value)?value:alternative;}
function artifactItem(mission,artifact,status){
 const observedAt=time(artifact.recordedAt,time(mission.updatedAt,0));
 return {projectId:mission.projectId,kind:artifact.kind,id:artifact.id,title:boundedTitle(artifact.kind==='check'?`${artifact.script||'Check'} check`:artifact.kind==='pull-request'?`Pull request ${artifact.number||''}`:'Deployment observation'),status,observedAt,target:{view:'mission',id:mission.id},sourceId:artifact.id,sourceTime:observedAt,detail:artifact.kind==='check'?`Source fingerprint: ${String(artifact.fingerprint||'unavailable').slice(0,120)}`:undefined};
}

function createWorkReport(snapshot,request={},now=Date.now()){
 const scope=validateScope(snapshot,request,now),projectSet=new Set(scope.projectIds);
 const projects=scope.projectIds.map(id=>{const project=snapshot.projects.find(item=>item.id===id);return {id,name:boundedTitle(project.name),tasks:[],missions:[],observations:[]};});
 const byProject=new Map(projects.map(project=>[project.id,project]));
 const attention=[];let itemCount=0,truncated=false;
 const include=item=>item.observedAt>=scope.since&&item.observedAt<=scope.until||UNRESOLVED.has(item.status);
 const add=(item,bucket,force=false)=>{if(!projectSet.has(item.projectId)||(!force&&!include(item)))return;if(itemCount>=MAX_ITEMS){truncated=true;return;}itemCount++;byProject.get(item.projectId)[bucket].push(item);if(ATTENTION.has(item.status))attention.push(item);};
 for(const task of snapshot.tasks||[]){
  const status=taskStatus(task),observedAt=time(task.updatedAt,time(task.createdAt,now));
  add({projectId:task.projectId,kind:'task',id:task.id,title:boundedTitle(task.title),status,observedAt,target:{view:'task',id:task.id},sourceId:task.id,sourceTime:observedAt},'tasks');
 }
 for(const mission of snapshot.missions||[]){
  const status=missionStatus(mission),observedAt=time(mission.updatedAt,time(mission.createdAt,now));
  const missionItem={projectId:mission.projectId,kind:'mission',id:mission.id,title:boundedTitle(mission.title),status,observedAt,target:{view:'mission',id:mission.id},sourceId:mission.id,sourceTime:observedAt};
  add(missionItem,'missions');
  if(!projectSet.has(mission.projectId))continue;
  const keepObservations=include(missionItem);
  const artifacts=(mission.artifacts||[]).filter(artifact=>artifact.attemptId===mission.activeAttemptId);
  const latestGit=artifacts.filter(artifact=>artifact.kind==='git').sort((left,right)=>time(right.recordedAt,0)-time(left.recordedAt,0))[0];
  for(const artifact of artifacts){
   if(artifact.kind==='check'){
    const stale=artifact.status==='passed'&&latestGit?.fingerprint&&artifact.fingerprint!==latestGit.fingerprint;
    add(artifactItem(mission,artifact,stale?'stale':artifact.status==='passed'?'passed':artifact.status==='failed'?'failed':'unknown'),'observations',keepObservations);
   }else if(artifact.kind==='pull-request'){
    const prStatus=artifact.checkStatus==='passed'?'passed':artifact.checkStatus==='failed'?'failed':artifact.checkStatus==='pending'?'pending':artifact.state==='MERGED'?'merged':'observed';
    add(artifactItem(mission,artifact,prStatus),'observations',keepObservations);
   }else if(artifact.kind==='deployment')add(artifactItem(mission,artifact,'observed'),'observations',keepObservations);
  }
  if(!artifacts.some(artifact=>artifact.kind==='deployment'))add({projectId:mission.projectId,kind:'deployment',id:mission.id+':deployment',title:'Deployment observation',status:'unobserved',observedAt,target:{view:'mission',id:mission.id},sourceId:mission.id,sourceTime:observedAt},'observations',keepObservations);
 }
 const taskById=new Map((snapshot.tasks||[]).map(task=>[task.id,task]));
 for(const approval of snapshot.approvals||[]){
  const task=taskById.get(approval.taskId);if(!task)continue;
  const observedAt=time(approval.time,time(task.updatedAt,now));
  add({projectId:task.projectId,kind:'approval',id:approval.id,title:`Approval for ${boundedTitle(task.title)}`,status:'waiting-approval',observedAt,target:{view:'task',id:task.id},sourceId:approval.id,sourceTime:observedAt},'observations');
 }
 return {createdAt:now,scope,coverage:{source:'saved-local-records',truncated,retainedEventLimit:500},projects,attention};
}

module.exports={createWorkReport,validateScope};
