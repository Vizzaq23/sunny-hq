'use strict';
// Observations only: this module cannot dispatch, approve, reconcile or release work.
const {createHash}=require('node:crypto');
const MAX_OBSERVATIONS=128,MAX_ENTRIES=200;
const labels={
 'approval-requested':'Permission requested; waiting for a decision',
 'approval-submitted':'Decision submitted to provider; execution not implied',
 'approval-resolved':'Provider closed the request; decision not inferred',
 'connection-lost':'Connection lost; last-known work requires reconciliation',
 'restart-unknown':'Saved active work restored as unknown; no automatic retry',
 'reconciled':'Provider state reconciled',
 'reconcile-unconfirmed':'Provider status could not be reconciled; outcome remains unknown',
 'interrupt-requested':'Local stop requested; remote completion is not implied',
 'turn-started':'Provider turn started',
 'turn-completed':'Provider turn ended; mission acceptance is separate',
 'command-started':'Provider reported command start',
 'command-completed':'Provider reported command completion',
 'result-recorded':'Reply recorded; inspect it in the conversation',
 'approval-conflict':'Conflicting pending request; connection invalidated'
};
const outcomes=new Set(['working','waiting','idle','unknown','finished','failed','interrupted','completed','inProgress','accept','decline','cancel']);
function ref(value){return typeof value==='string'||typeof value==='number'?createHash('sha256').update(String(value)).digest('hex').slice(0,24):null;}
function time(value){return Number.isFinite(value)&&value>=0&&value<=8640000000000000?value:null;}
function hash(value){return typeof value==='string'&&/^[a-f0-9]{24}$/.test(value)?value:null;}
function clean(value){
 if(!value||value.version!==1||!Object.hasOwn(labels,value.kind)||!hash(value.id))return null;
 const entry={version:1,id:value.id,kind:value.kind,time:time(value.time)};
 for(const field of ['executionRef','turnRef','requestRef','itemRef'])entry[field]=hash(value[field]);
 entry.outcome=outcomes.has(value.outcome)?value.outcome:'unknown';
 if(Number.isSafeInteger(value.exitCode))entry.exitCode=value.exitCode;
 return entry;
}
function observe(task,kind,source,{executionId=task.executionId,turnId=task.turnId,requestId,itemId,outcome,exitCode,now=Date.now()}={}){
 // A corrupt diagnostic field must never prevent an interrupt or an approval refusal.
 try{
  const entry=clean({version:1,id:ref(JSON.stringify([kind,executionId,turnId,source])),kind,time:now,executionRef:ref(executionId),turnRef:ref(turnId),requestRef:ref(requestId),itemRef:ref(itemId),outcome,exitCode});
  if(!entry)return false;
  const prior=(Array.isArray(task.diagnosticObservations)?task.diagnosticObservations:[]).slice(-MAX_OBSERVATIONS).map(clean).filter(Boolean);
  if(prior.some(e=>e.id===entry.id))return false;
  prior.push(entry);if(prior.length>MAX_OBSERVATIONS){prior.shift();task.diagnosticDropped=Math.min(Number.MAX_SAFE_INTEGER,(Number.isSafeInteger(task.diagnosticDropped)?task.diagnosticDropped:0)+1);}
  task.diagnosticObservations=prior;return true;
 }catch{return false;}
}
function validateScope(state,input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['projectId','taskId','missionId','limit'].includes(k)))throw Error('Invalid diagnostic scope.');
 for(const key of ['projectId','taskId','missionId'])if(input[key]!==undefined&&(typeof input[key]!=='string'||!input[key]||input[key].length>200))throw Error('Invalid diagnostic scope.');
 if(!state.projects.some(p=>p.id===input.projectId))throw Error('Diagnostic project is unavailable.');
 if(input.limit!==undefined&&(!Number.isInteger(input.limit)||input.limit<1||input.limit>MAX_ENTRIES))throw Error('Invalid diagnostic limit.');
 const task=input.taskId&&state.tasks.find(t=>t.id===input.taskId),mission=input.missionId&&state.missions?.find(m=>m.id===input.missionId);
 if(input.taskId&&(!task||task.projectId!==input.projectId)||input.missionId&&(!mission||mission.projectId!==input.projectId)||task&&mission&&!mission.taskIds?.includes(task.id))throw Error('Diagnostic work does not belong to this scope.');
 return {task,mission};
}
function timeline(state,input,{now=Date.now(),persistence='unknown'}={}){
 const scope=validateScope(state,input),entries=new Map(),limit=input.limit??MAX_ENTRIES;
 const allTasks=state.tasks.filter(t=>t.projectId===input.projectId&&(!scope.task||t.id===scope.task.id)&&(!scope.mission||scope.mission.taskIds?.includes(t.id))),tasks=allTasks.slice(0,200);
 const allMissions=(state.missions||[]).filter(m=>m.projectId===input.projectId&&(!scope.mission||m.id===scope.mission.id)&&(!scope.task||m.taskIds?.includes(scope.task.id))),missions=allMissions.slice(0,100);
 const binding=(task,executionRef)=>{
  const matches=missions.flatMap(m=>(m.attempts||[]).filter(a=>a.taskIds?.includes(task.id)).map(a=>({m,a})));
  // A task's current attempt must not be borrowed by an older execution observation.
  const exact=matches.length===1?matches[0]:null;
  return {projectRef:ref(input.projectId),taskRef:ref(task.id),missionRef:exact?ref(exact.m.id):null,attemptRef:exact?ref(exact.a.id):null,executionRef:executionRef===undefined?ref(task.executionId):executionRef};
 };
 const add=e=>{if(!entries.has(e.id))entries.set(e.id,e);};
 for(const task of tasks){
  const observations=(Array.isArray(task.diagnosticObservations)?task.diagnosticObservations:[]).slice(-MAX_OBSERVATIONS).map(clean).filter(Boolean);
  for(const e of observations)add({...e,...binding(task,e.executionRef),id:ref(task.id+':'+e.id),source:'task-observation',sourceRef:e.id,label:labels[e.kind],basis:'observed'});
  add({id:ref(task.id+':state'),...binding(task),source:'task',sourceRef:ref(task.id),time:time(task.updatedAt),kind:'task-state',label:task.status==='unknown'?'Last-known task state; reconcile before continuing':'Current saved task state; not a transition history',outcome:outcomes.has(task.status)?task.status:'unknown',basis:'snapshot'});
  const intent=task.approvalResponseIntent;
  if(intent&&!observations.some(e=>e.kind==='approval-submitted'&&e.requestRef===ref(intent.approvalId)))add({id:ref(task.id+':intent:'+intent.id),...binding(task,ref(intent.executionId)),turnRef:ref(intent.turnId),requestRef:ref(intent.approvalId),source:'approval-intent',sourceRef:ref(intent.id),time:time(intent.submittedAt??intent.createdAt),kind:'approval-intent',label:intent.state==='submitted'?'Saved decision submission; execution not implied':'Prepared decision; submission is unconfirmed',outcome:outcomes.has(intent.decision)?intent.decision:'unknown',basis:'saved-record'});
 }
 for(const a of state.approvals||[]){const task=tasks.find(t=>t.id===a.taskId);if(!task)continue;
  const recorded=(Array.isArray(task.diagnosticObservations)?task.diagnosticObservations:[]).some(e=>e?.kind==='approval-requested'&&e.requestRef===ref(a.id));
  const call=require('./run-presentation.cjs').callBinding(state,a),link=binding(task);
  if(call?.attemptId&&call.attemptId!=='none')link.attemptRef=ref(call.attemptId);
  if(!recorded)add({id:ref('pending:'+a.id),...link,turnRef:ref(a.turnId),requestRef:ref(a.id),source:'pending-approval',sourceRef:ref(a.id),time:time(a.createdAt),kind:'approval-requested',label:labels['approval-requested'],outcome:'waiting',basis:'snapshot'});
 }
 const missionLabels={MISSION_CREATED:'Mission brief saved',MISSION_STARTED:'Mission attempt started',TASK_ASSIGNED:'Crew assignment recorded',CONNECTION_UNCERTAIN:'Mission connection uncertain',MISSION_COMPLETE:'Mission completion recorded; inspect the acceptance receipt',CHANGES_REQUESTED:'Captain requested changes',MISSION_FAILED:'Mission failure recorded',APPROVAL_REQUESTED:'Mission waiting for permission',RESULT_SELECTED:'Result selected for review',TEST_PASSED:'Recorded check passed',TEST_FAILED:'Recorded check failed'};
 for(const m of missions){
  add({id:ref(m.id+':state'),projectRef:ref(m.projectId),missionRef:ref(m.id),attemptRef:ref(m.activeAttemptId),source:'mission',sourceRef:ref(m.id),time:time(m.updatedAt),kind:'mission-state',label:'Current mission record; acceptance requires its own receipt',outcome:['DRAFT','RUNNING','WAITING_FOR_REVIEW','NEEDS_USER','BLOCKED','FAILED','CANCELLED','COMPLETE'].includes(m.status)?m.status:'unknown',basis:'snapshot'});
  for(const a of (m.artifacts||[]).slice(-256)){if(a.kind!=='check')continue;add({id:ref(m.id+':check:'+a.id),projectRef:ref(m.projectId),missionRef:ref(m.id),attemptRef:ref(a.attemptId),source:'check-artifact',sourceRef:ref(a.id),time:time(a.recordedAt),kind:'check-recorded',label:'Recorded check outcome; output and command omitted',outcome:['passed','failed','stale'].includes(a.status)?a.status:'unknown',basis:'saved-record',...(Number.isSafeInteger(a.exitCode)?{exitCode:a.exitCode}:{})});}
  const accepted=m.acceptance;if(accepted?.id&&accepted.legacy!==true)add({id:ref(m.id+':acceptance:'+accepted.id),projectRef:ref(m.projectId),missionRef:ref(m.id),attemptRef:ref(accepted.attemptId),source:'acceptance-receipt',sourceRef:ref(accepted.id),time:time(accepted.acceptedAt),kind:'captain-acceptance',label:'Captain acceptance receipt recorded; inspect the bound snapshot in mission review',outcome:'recorded',basis:'saved-record'});
  for(const e of (m.events||[]).slice(-500))add({id:ref(m.id+':'+e.id),projectRef:ref(m.projectId),missionRef:ref(m.id),attemptRef:ref(e.attemptId),taskRef:ref(e.taskId),source:'mission-event',sourceRef:ref(e.id),time:time(e.time),kind:'mission-event',label:missionLabels[e.type]||'Mission record updated; inspect the mission for details',outcome:'recorded',basis:'saved-record',sequence:Number.isSafeInteger(e.sequence)?e.sequence:null});
  const r=m.selectedResult;if(r)add({id:ref(m.id+':result:'+r.id),projectRef:ref(m.projectId),missionRef:ref(m.id),attemptRef:ref(r.attemptId),taskRef:ref(r.producerTaskId),source:'selected-result',sourceRef:ref(r.id),time:time(r.selectedAt),kind:'result-selected',label:'Selected result is available in mission review; file paths omitted',outcome:'recorded',basis:'saved-record'});
 }
 const ordered=[...entries.values()].sort((a,b)=>(a.time??Infinity)-(b.time??Infinity)||a.id.localeCompare(b.id));
 return {version:1,generatedAt:now,projectRef:ref(input.projectId),privacy:'Redacted: no prompts, titles, commands, output, errors or paths.',ordering:'Local observation times; equal or missing times do not establish causal order.',coverage:'Retained records only. Older activity and unflushed observations may be missing. Finished turns are not captain acceptance.',persistence:['saved','pending','unsaved','uncertain'].includes(persistence)?persistence:'unknown',truncated:ordered.length>limit||allTasks.length>tasks.length||allMissions.length>missions.length,retainedEntries:ordered.length,observationLimit:MAX_OBSERVATIONS,droppedObservations:tasks.reduce((sum,t)=>sum+(Number.isSafeInteger(t.diagnosticDropped)&&t.diagnosticDropped>0?t.diagnosticDropped:0),0),tasksWithoutObservations:tasks.filter(t=>!Array.isArray(t.diagnosticObservations)||!t.diagnosticObservations.length).length,entries:ordered.slice(-limit)};
}
module.exports={observe,timeline,validateScope,ref,MAX_OBSERVATIONS,MAX_ENTRIES};
