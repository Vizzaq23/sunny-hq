const {randomUUID}=require('node:crypto');
const {MAX_TEXT_BYTES,readTranscriptPage,validatePageRequest,validateMessageMetadata,boundary}=require('./transcript-pages.cjs');
const TASK_FIELDS=['id','title','projectId','crewId','threadId','status','createdAt','updatedAt','turnId','external','error','jobId','model','effort','selectionReason','captain','parentTaskId','runId','assignmentId','workspaceId'];
const SKILL_FIELDS=['id','revision','name','path','category','purpose'];
const TOKEN_FIELDS=['totalTokens','inputTokens','outputTokens','cachedInputTokens','reasoningOutputTokens'];
function pick(value,keys){const out={};for(const key of keys)if(['string','number','boolean'].includes(typeof value?.[key]))out[key]=value[key];return out;}
function preview(text){let end=Math.min(text.length,2000);if(!boundary(text,end))end--;return text.slice(0,end);}
function metadata(task){
 const messages=new Map();let assistant,activity;
 for(const m of task.messages){messages.set(m.id,{length:m.text.length,role:m.role,time:m.time});if(m.role==='assistant')assistant=m;if(m.role==='system')activity=m;}
 return {messages,count:task.messages.length,lastAssistantId:assistant?.id,latestActivityId:activity?.id,lastAssistantPreview:assistant?preview(assistant.text):undefined,latestActivity:activity?preview(activity.text):undefined};
}

// Existing public domain fields are explicitly listed. Opaque profile extensions do not
// become renderer state. `any` payloads are existing, intentional public API fields.
const scalar=true,any='any';
const arr=spec=>[spec];
const skill={...Object.fromEntries(SKILL_FIELDS.map(k=>[k,scalar])),roles:arr(scalar)};
const context={runId:scalar,projectId:scalar,missionId:scalar,attemptId:scalar,taskId:scalar,surface:scalar,returnTo:{view:scalar,runId:scalar,attemptId:scalar,projectId:scalar,missionId:scalar,taskId:scalar}};
const artifact=Object.fromEntries(['id','attemptId','projectId','producer','kind','width','height','mimeType','repository','limited','filePath','bytes','sha256','number','url','state','checkStatus','reviewDecision','recordedAt','commit','branch','fingerprint','dirty','script','command','status','exitCode','durationMs'].map(k=>[k,scalar]));
artifact.paths=arr(scalar);artifact.provenance={source:scalar,usage:scalar};artifact.deployments=arr(Object.fromEntries(['id','environment','state','createdAt','statusAt','statusId','url','production'].map(k=>[k,scalar])));
const attempt={...Object.fromEntries(['id','taskId','status','startedAt','completedAt','error','requestedChanges','workflowVersion'].map(k=>[k,scalar])),taskIds:arr(scalar),selectedSkills:arr(skill),workflow:{complete:scalar,stages:arr({id:scalar,status:scalar,taskId:scalar})},routing:{roleId:scalar,crewId:scalar,provider:scalar,reason:scalar}};
const mission={...Object.fromEntries(['id','projectId','title','objective','completionBoundary','status','connection','revision','createdAt','updatedAt','activeAttemptId','acceptedAt','runId'].map(k=>[k,scalar])),acceptanceCriteria:arr(scalar),taskIds:arr(scalar),attempts:arr(attempt),artifacts:arr(artifact),events:arr({id:scalar,type:scalar,time:scalar,sequence:scalar}),seenEventIds:arr(scalar),checkExecution:{id:scalar,attemptId:scalar,script:scalar,startedAt:scalar},branch:{name:scalar,baseCommit:scalar,baseBranch:scalar,state:scalar},selectedResult:{id:scalar,attemptId:scalar,producerTaskId:scalar,selectedAt:scalar,ref:{kind:scalar,taskId:scalar,messageId:scalar,artifactId:scalar,sha256:scalar}},acceptance:{legacy:scalar,id:scalar,actor:scalar,attemptId:scalar,reviewedRevision:scalar,resultId:scalar,resultSha256:scalar,criteria:arr(scalar),acceptedAt:scalar,prArtifactId:scalar}};
mission.mergeRequest=Object.fromEntries(['id','attemptId','repository','number','url','commit','baseBranch','method','state','expiresAt'].map(k=>[k,scalar]));
mission.prPublication=Object.fromEntries(['id','attemptId','repository','branch','base','commit','title','body','state','url','number','expiresAt'].map(k=>[k,scalar]));
const crew=Object.fromEntries(['spriteRow','district','id','name','role','color','station','description','recruited'].map(k=>[k,scalar]));
const job={...Object.fromEntries(['id','name','crewId','projectId','district','objective','intervalMinutes','maxRunsPerDay','maxTotalRuns','maxRunMinutes','dailyTokenLimit','requiresReview','enabled','status','error','activeTaskId','nextAt'].map(k=>[k,scalar])),runs:arr({taskId:scalar,startedAt:scalar,status:scalar})};
const stateSchema={projects:arr({id:scalar,name:scalar,path:scalar,category:scalar,notePath:scalar}),settings:{reducedMotion:scalar,notifications:scalar,roomSoundEnabled:scalar,roomSoundVolume:scalar,model:scalar,routingPolicy:scalar},codex:{status:scalar,version:scalar,account:scalar,error:scalar},persistence:{state:scalar,failures:scalar,uncertain:scalar},workspace:{version:scalar,revision:scalar,context,drafts:arr({id:scalar,kind:scalar,projectId:scalar,taskId:scalar,title:scalar,text:scalar,criteria:arr(scalar),completionBoundary:scalar,revision:scalar,updatedAt:scalar}),seenAcceptanceIds:arr(scalar)},missions:arr(mission),missionRoles:arr({id:scalar,label:scalar,crewId:scalar,capability:scalar,provider:scalar}),tools:arr({id:scalar,name:scalar,category:scalar,description:scalar,status:scalar,url:scalar,path:scalar}),approvals:arr({id:scalar,method:scalar,params:any,taskId:scalar}),models:arr(any),usage:any,automations:arr(any),news:{items:arr(Object.fromEntries(['id','url','title','summary','why','nextStep','source','category','projectId','publishedAt','capturedAt','origin','verification','status'].map(k=>[k,scalar]))),captureMode:scalar,lastCaptureAt:scalar,lastOrigin:scalar,preferences:{roles:scalar,location:scalar,topics:scalar}},world:{paused:scalar,maxConcurrentJobs:scalar,residents:arr(crew),jobs:arr(job),error:scalar,ledger:arr({id:scalar,amount:scalar,note:scalar,time:scalar,source:scalar})},discussions:arr({id:scalar,crew:arr(scalar),topic:scalar,status:scalar,time:scalar,error:scalar,messages:arr({crewId:scalar,text:scalar,time:scalar})})};
const decision={id:scalar,runId:scalar,revision:scalar,type:scalar,time:scalar,option:scalar,reason:scalar,dissent:arr(scalar),owner:scalar,nextAction:scalar,reopenEvidence:scalar,details:{assignmentId:scalar,taskId:scalar,reason:scalar,sourceId:scalar,findingId:scalar,outcome:scalar}};
stateSchema.runs=arr({presentation:{calls:arr({requestId:scalar,projectId:scalar,runId:scalar,attemptId:scalar,revision:scalar,state:scalar,time:scalar,taskId:scalar,type:scalar,resolved:scalar})},controlIntent:{action:scalar,state:scalar,revision:scalar,time:scalar},controlReport:{runId:scalar,revision:scalar,queuedCancelled:arr(scalar),interruptionRequested:arr(scalar),confirmedStopped:arr(scalar),unknownEffects:arr(scalar),errors:arr({id:scalar,message:scalar})},readiness:{version:scalar,resultId:scalar,resultSha256:scalar,checkIds:arr(scalar),criteriaIds:arr(scalar),reviewIds:arr(scalar),time:scalar},counters:{launches:scalar,repairs:scalar,activeMs:scalar,tokens:scalar,improvementMs:scalar,improvementTokens:scalar},id:scalar,projectId:scalar,missionIds:arr(scalar),revision:scalar,phase:scalar,objective:scalar,originalScope:{projectId:scalar,objective:scalar,activities:arr(scalar),standingImprovement:scalar},criteria:arr({id:scalar,text:scalar}),grant:{id:scalar,revision:scalar,scope:{projectId:scalar,objective:scalar,activities:arr(scalar),standingImprovement:scalar},maxWorkers:scalar,maxInitialAssignments:scalar,maxLaunches:scalar,maxRepairs:scalar,workerMs:scalar,activeMs:scalar,tokenLimit:scalar,improvementMs:scalar,improvementTokens:scalar},assignments:arr({id:scalar,crewId:scalar,roleId:scalar,capability:scalar,objective:scalar,state:scalar,taskId:scalar,dependencies:arr(scalar),criteriaIds:arr(scalar)}),decisions:arr(decision),blockers:arr({id:scalar,kind:scalar,reason:scalar,time:scalar,revision:scalar}),stopIntent:{id:scalar,requestedBy:scalar,reason:scalar,time:scalar,revision:scalar},disagreementRounds:scalar});
const memory={id:scalar,kind:scalar,text:scalar,time:scalar,source:{taskId:scalar,messageId:scalar,projectId:scalar,exchangeId:scalar,otherCrew:scalar}};
stateSchema.growth={enabled:scalar,profiles:{$record:{xp:scalar,conversations:scalar,memories:arr(memory),relationships:{$record:{exchanges:scalar,lastTopic:scalar,lastAt:scalar}}}}};
function project(value,schema){
 if(value===undefined)return undefined;
 if(value===null)return null;
 if(schema===any)return structuredClone(value);
 if(schema===scalar)return ['string','number','boolean'].includes(typeof value)?value:undefined;
 if(Array.isArray(schema))return Array.isArray(value)?value.map(v=>project(v,schema[0])):undefined;
 if(typeof value!=='object')return undefined;
 const out={};for(const key of schema.$record?Object.keys(value):Object.keys(schema)){const v=project(value[key],schema.$record||schema[key]);if(v!==undefined)Object.defineProperty(out,key,{value:v,enumerable:true,writable:true,configurable:true});}return out;
}

function createStateProjection({epoch=randomUUID()}={}){
 if(typeof epoch!=='string'||!epoch||epoch.length>512)throw Error('Invalid public producer epoch.');
 let sequence=0;const tasks=new Map();
 function tracked(task){let entry=tasks.get(task.id);if(!entry){entry={revision:1,...metadata(task)};tasks.set(task.id,entry);}return entry;}
 function summary(task){
  const entry=tracked(task),out={...pick(task,TASK_FIELDS),transcriptRevision:entry.revision,messageCount:task.messages.length};
  if(task.selectedSkills)out.selectedSkills=project(task.selectedSkills,arr(skill));
  if(task.tokenUsage)out.tokenUsage={total:pick(task.tokenUsage.total,TOKEN_FIELDS)};
  if(entry.lastAssistantPreview!==undefined)out.lastAssistantPreview=entry.lastAssistantPreview;
  if(entry.latestActivity!==undefined)out.latestActivity=entry.latestActivity;
  out.kind=task.runId?'supervised-assignment':'conversation';
  return out;
 }
 function snapshot(state){
  const projected=project(state,stateSchema);if(projected.approvals)projected.approvals=projected.approvals.map((a,index)=>({...a,...(require('./run-presentation.cjs').callBinding(state,state.approvals[index])?{binding:require('./run-presentation.cjs').callBinding(state,state.approvals[index])}:{})}));if(projected.runs)projected.runs.forEach((r,i)=>{r.playableLaunches=(state.runs[i].playableLaunches||[]).map(receipt=>require('./playable-receipts.cjs').publicReceipt(receipt,state.runs[i]));});projected.crewReports=(state.runs||[]).slice(0,1000).map(run=>require('./crew-reports.cjs').buildCrewReport({run,missions:state.missions||[],now:Date.now()}));
  if(projected.runs)projected.runs=projected.runs.map((run,index)=>({...run,resolution:require('./conflict-resolution.cjs').summary(state.runs[index]),budget:{warningIssued:state.runs[index]?.accounting?.warningAt!==null&&state.runs[index]?.accounting?.warningAt!==undefined,clockUncertain:state.runs[index]?.accounting?.clock?.uncertain===true,telemetryUncertain:state.runs[index]?.accounting?.telemetryUncertain===true}}));
  if(projected.missions)projected.missions=projected.missions.map((mission,index)=>({...mission,acceptancePending:Boolean(state.missions[index]?.pendingAcceptance||state.missions[index]?.acceptanceRecovery)}));
  return {...projected,protocolVersion:2,epoch,sequence,taskSummaries:(state.tasks||[]).map(summary)};
 }
 function nextSequence(){if(sequence===Number.MAX_SAFE_INTEGER)throw Error('Public producer sequence exhausted.');return ++sequence;}
 function event(type,data){nextSequence();return {type,epoch,sequence,data:type==='snapshot'?snapshot(data):type==='task'?summary(data):structuredClone(data)};}
 function transcriptChanged(task,change={kind:'invalidate'}){
  const seeded=tasks.has(task.id),entry=tracked(task),baseRevision=entry.revision;
  if(baseRevision===Number.MAX_SAFE_INTEGER)throw Error('Transcript revision exhausted.');
  const m=task.messages.find(m=>m.id===change.messageId),old=entry.messages.get(change.messageId);
  if(m&&['appendMessage','appendText'].includes(change.kind))validateMessageMetadata(m);
  const delta={epoch,sequence:nextSequence(),taskId:task.id,baseRevision,revision:++entry.revision,kind:'invalidate'};
  let text;
  if(seeded&&m&&change.kind==='appendMessage'&&!old&&task.messages.length===entry.count+1&&task.messages.at(-1)===m)text=m.text;
  if(seeded&&m&&old&&change.kind==='appendText'&&task.messages.length===entry.count&&change.offset===old.length&&typeof change.text==='string'&&change.text.length<=MAX_TEXT_BYTES&&Buffer.byteLength(change.text,'utf8')<=MAX_TEXT_BYTES&&m.text.length===old.length+change.text.length&&boundary(m.text,change.offset)&&m.role===old.role&&m.time===old.time&&m.text.slice(change.offset)===change.text)text=change.text;
  if(typeof text==='string'&&text.length<=MAX_TEXT_BYTES&&Buffer.byteLength(text,'utf8')<=MAX_TEXT_BYTES){
   Object.assign(delta,{kind:change.kind,messageId:m.id,offset:change.kind==='appendMessage'?0:change.offset,text});
   if(change.kind==='appendMessage')Object.assign(delta,{role:m.role,time:m.time});
   entry.messages.set(m.id,{length:m.text.length,role:m.role,time:m.time});entry.count=task.messages.length;
   // Only the bounded preview is copied. The immutable full transcript stays with main.
   if(m.role==='assistant'&&(change.kind==='appendMessage'||m.id===entry.lastAssistantId)){entry.lastAssistantId=m.id;entry.lastAssistantPreview=preview(m.text);}
   if(m.role==='system'&&(change.kind==='appendMessage'||m.id===entry.latestActivityId)){entry.latestActivityId=m.id;entry.latestActivity=preview(m.text);}
  }else Object.assign(entry,metadata(task));
  return delta;
 }
 function page(state,request){
  validatePageRequest(request);
  if(!state.projects?.some(p=>p.id===request.projectId))throw Error('Transcript project membership mismatch.');
  const task=state.tasks?.find(t=>t.id===request.taskId);
  if(!task)throw Error('Transcript task was deleted or is unavailable.');
  if(task.projectId!==request.projectId)throw Error('Transcript task/project membership mismatch.');
  const current=summary(task),result=readTranscriptPage({epoch,task,revision:current.transcriptRevision},request);
  return result.stale?{...result,summary:current}:result;
 }
 // Seed summary(task) BEFORE the first mutation, then call transcriptChanged AFTER
 // EVERY transcript mutation. appendText is a trusted mutation classification;
 // offset/suffix checks cannot prove an untouched old prefix. Edits/replacements
 // MUST use invalidate. Unseeded/unknown edits conservatively invalidate.
 // Publish returned delta directly; event() would consume a second sequence.
 return {epoch,get sequence(){return sequence;},summary,snapshot,event,transcriptChanged,page,forgetTask(taskId){tasks.delete(taskId);}};
}

module.exports={createStateProjection};
