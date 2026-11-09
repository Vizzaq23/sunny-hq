// Read-only, bounded projection. A recorded dependency is not proof of message delivery.
const LIMIT=32;
const validId=value=>typeof value==='string'&&value.trim().length>0&&value.length<=200&&!value.includes('\0');
const unique=values=>values.length===1?values[0]:undefined;
const list=value=>Array.isArray(value)?value:[];
function excerpt(value,max){return typeof value==='string'&&value.trim()?{text:value.slice(0,max),limited:value.length>max}:null;}
function identity(task){return task?{id:task.id,crewId:task.crewId,status:task.status}:null;}
function selection(state,args){
 const keys=['projectId','missionId','attemptId','revision'];
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==keys.length||Object.keys(args).some(key=>!keys.includes(key))||!keys.slice(0,3).every(key=>validId(args[key]))||!Number.isSafeInteger(args.revision)||args.revision<0)throw Error('Invalid handoff selection.');
 if(!unique(list(state.projects).filter(p=>p.id===args.projectId)))throw Error('Handoff project unavailable.');
 const mission=unique(list(state.missions).filter(m=>m.id===args.missionId&&m.projectId===args.projectId));
 if(!mission)throw Error('Handoff mission unavailable for this project.');
 if(mission.revision!==args.revision)throw Error('Mission changed. Refresh its handoffs.');
 const attempt=unique(list(mission.attempts).filter(a=>a.id===args.attemptId));
 if(!attempt)throw Error('Selected handoff attempt unavailable.');
 const run=unique(list(state.runs).filter(r=>r.id===mission.runId&&r.projectId===mission.projectId&&list(r.missionIds).includes(mission.id)));
 return {mission,attempt,run};
}
function query(state,args){
 const {mission,attempt,run}=selection(state,args);
 const tasks=list(state.tasks),members=new Set(list(attempt.taskIds).filter(id=>list(mission.taskIds).includes(id)));
 function taskFor(id){
  const task=unique(tasks.filter(t=>t.id===id&&t.projectId===mission.projectId&&!t.external));
  if(!task)return;
  if(members.has(id))return task;
  if(run&&task.runId===run.id&&members.has(task.parentTaskId)&&unique(list(run.assignments).filter(a=>a.id===task.assignmentId&&a.taskId===id&&a.crewId===task.crewId)))return task;
 }
 const parcels=[],seen=new Set();let omitted=0;
 function add({key,basis,from,to,assignment,source}){
  if(seen.has(key))return;seen.add(key);
  if(parcels.length>=LIMIT){omitted++;return;}
  const first=list(to?.messages).find(m=>m.role==='user'&&typeof m.text==='string'&&m.text.trim());
  const result=list(from?.messages).findLast(m=>m.role==='assistant'&&typeof m.text==='string'&&m.text.trim());
  const files=list(source?.artifactHashes).slice(0,32).map(f=>({path:typeof f.path==='string'?f.path.slice(0,4096):'Unavailable',sha256:typeof f.sha256==='string'?f.sha256.slice(0,64):null}));
  parcels.push({id:JSON.stringify([mission.id,attempt.id,key]),basis,from:identity(from),to:identity(to),assignmentId:assignment?.id??null,
   brief:first?{...excerpt(first.text,4000),source:'recipient-message',messageId:first.id??null}:assignment&&excerpt(assignment.objective,4000)?{...excerpt(assignment.objective,4000),source:'assignment-objective',messageId:null}:null,
   result:result?{...excerpt(result.text,2000),messageId:result.id??null,attribution:'Generated predecessor output; not verified evidence'}:null,
   recordedAt:Number.isFinite(first?.time)?first.time:null,
   source:source?{commit:typeof source.headCommit==='string'?source.headCommit.slice(0,200):null,fingerprint:typeof source.fingerprint==='string'?source.fingerprint.slice(0,200):null,files,limited:list(source.artifactHashes).length>32}:null});
 }
 // Run dependencies are admitted only through attempt-bound recipient and predecessor tasks.
 if(run){for(const recipient of list(run.assignments)){
  const to=taskFor(recipient.taskId);if(!to||to.assignmentId!==recipient.id||to.runId!==run.id)continue;
  for(const dependencyId of new Set(list(recipient.dependencies))){
   const predecessor=unique(list(run.assignments).filter(a=>a.id===dependencyId));
   const from=predecessor?taskFor(predecessor.taskId):undefined;
   // A missing predecessor is represented, but another attempt's task is never disclosed.
   add({key:`dependency:${dependencyId}:${recipient.id}`,basis:'Recorded assignment dependency',from,to,assignment:recipient,source:from?predecessor.sourceResult:undefined});
  }
 }}
 // Legacy coordinated workflows record ordered stages rather than explicit dependency edges.
 if(!run){const stages=list(attempt.workflow?.stages);for(let i=1;i<stages.length;i++){
  const previous=stages[i-1],next=stages[i];
  add({key:`stage:${previous.id}:${next.id}`,basis:`Recorded stage order: ${previous.id} → ${next.id}`,from:taskFor(previous.taskId),to:taskFor(next.taskId)});
 }}
 const artifacts=list(mission.artifacts).filter(a=>a.projectId===mission.projectId&&a.attemptId===attempt.id);
 const evidence=[];for(const artifact of artifacts){if(!['git','check'].includes(artifact.kind))continue;if(evidence.length>=32)break;
  evidence.push({id:artifact.id,kind:artifact.kind,commit:artifact.commit??null,fingerprint:artifact.fingerprint??null,recordedAt:artifact.recordedAt??null,
   paths:artifact.kind==='git'?list(artifact.paths).slice(0,32).map(p=>String(p).slice(0,4096)):[],limited:list(artifact.paths).length>32,
   script:artifact.kind==='check'?excerpt(artifact.script,100)?.text??null:null,status:artifact.kind==='check'?artifact.status??'unavailable':null,
   exitCode:Number.isInteger(artifact.exitCode)?artifact.exitCode:null,durationMs:Number.isFinite(artifact.durationMs)?artifact.durationMs:null});
 }
 return {version:1,projectId:mission.projectId,missionId:mission.id,attemptId:attempt.id,revision:mission.revision,runRevision:run?.revision??null,historical:mission.activeAttemptId!==attempt.id,
  requestedChanges:excerpt(attempt.requestedChanges,2000),parcels,evidence,limited:omitted>0||artifacts.filter(a=>['git','check'].includes(a.kind)).length>32,
  coverage:'Recorded relationships and retained payloads. These records do not prove that predecessor output was forwarded verbatim. File references are not opened or reverified by this view.'};
}
module.exports={query,selection};
