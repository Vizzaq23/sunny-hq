const {createHash}=require('node:crypto');
const {stable,sameSource}=require('./review-verdicts.cjs');
const registry=require('./crew-registry.cjs');
const digest=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const names={ 'production-coordinator':['sunny_status','sunny_plan','sunny_decide','sunny_deliver'],'validation-coordinator':['sunny_status','sunny_validate'],reviewer:['sunny_status','sunny_review']};
const statusTool={type:'function',name:'sunny_status',description:'Read the exact current bounded session context before mutation. Never grants authority.',inputSchema:{type:'object',additionalProperties:false,required:['runId','projectId'],properties:{runId:{type:'string',maxLength:200},projectId:{type:'string',maxLength:200}}}};
function membership(hub,task){
 for(const run of hub.state.runs){if(!run.ordinary||!run.currentEpoch)continue;const epoch=run.currentEpoch,mission=hub.state.missions.find(m=>m.id===epoch.missionId&&m.runId===run.id&&m.activeAttemptId===epoch.id);if(!mission)continue;
  const delivery=(run.deliveries||[]).find(d=>d.epochId===epoch.id&&d.continuation?.taskId===task.id);
  if(delivery)return {run,mission,role:'validation-coordinator',delivery};
  if(epoch.coordinatorTaskId===task.id)return {run,mission,role:'production-coordinator',delivery:(run.deliveries||[]).find(d=>d.epochId===epoch.id)};
  const assignment=run.assignments.find(a=>a.taskId===task.id&&epoch.assignmentIds.includes(a.id));if(registry.reviewAssignment(assignment))return {run,mission,assignment,role:'reviewer',delivery:(run.deliveries||[]).find(d=>d.id===assignment.reviewBinding?.deliveryId)};
 }return null;
}
function bound(hub,task,m){if(hub.closed||hub.quiescing||!hub.client.connected||m.run.stopIntent||m.run.controlIntent?.state==='pending'||['paused','stopping','stopped','unknown'].includes(m.run.phase))return false;if(hub.pendingSessionBindings?.has(task.id)||!task.threadId||!task.turnId||!['working','waiting'].includes(task.status))return false;if(m.role==='reviewer')return !!m.assignment.reviewBinding;return m.run.coordinator?.taskId===task.id&&m.run.coordinator.threadId===task.threadId&&m.run.coordinator.turnId===task.turnId;}
function context(hub,task,{pending=false}={}){
 const m=membership(hub,task);if(!m)return null;const {run,mission,role,assignment,delivery}=m;
 const value={version:1,session:{role,taskId:task.id,bindingState:!pending&&bound(hub,task,m)?'bound':'pending'},run:{id:run.id,projectId:run.projectId,revision:run.revision,phase:run.phase,epochId:run.currentEpoch.id,grantRevision:run.grant.revision||0},mission:{id:mission.id,attemptId:run.currentEpoch.id},criteria:structuredClone(run.criteria),checkPlan:structuredClone(run.ordinary.checkPlan),checkpoint:structuredClone(delivery?.source||run.ordinary.checkpoint),assignments:run.assignments.filter(a=>run.currentEpoch.assignmentIds.includes(a.id)).map(a=>({id:a.id,crewId:a.crewId,capability:a.capability,state:a.state,dependencies:a.dependencies,criteriaIds:a.criteriaIds})),operations:names[role],remaining:{launches:Math.max(0,run.grant.maxLaunches-run.counters.launches),repairs:Math.max(0,run.grant.maxRepairs-run.counters.repairs),activeMs:Math.max(0,run.grant.activeMs-run.counters.activeMs),tokens:Math.max(0,run.grant.tokenLimit-run.counters.tokens)}};
 if(run.currentEpoch.productionWaves){const w=delivery?.productionWave,cp=w?.checkpoints.at(-1);value.productionWave={version:1,active:w?.active||0,graphDigest:run.currentEpoch.productionWaves.digest,waitingAssignmentIds:run.currentEpoch.productionWaves.waves.slice((w?.active||0)+1).flat(),...(cp?{checkpointId:cp.id,source:structuredClone(cp.source)}:{})};}
 if(delivery){value.deliveryState={stage:delivery.stage,...(delivery.reasonCode?{reasonCode:delivery.reasonCode}:{}),missingReviewerIds:delivery.reviewAssignmentIds.filter(id=>!run.reviews.some(v=>v.assignmentId===id&&v.decision==='approve'&&currentReview(run,v.reviewBinding)))};value.deliveryId=delivery.id;if(delivery.continuation)value.continuationId=delivery.continuation.id;if(delivery.selectedResult)value.result={id:delivery.selectedResult.id,sha256:delivery.selectedResult.sha256};}
 if(role==='reviewer'){value.reviewAssignmentId=assignment.id;value.reviewBinding=structuredClone(assignment.reviewBinding);value.source=structuredClone(run.verification?.source);value.checkReceipts=structuredClone(run.verification?.checks||[]);}
 if(Buffer.byteLength(JSON.stringify(value))>80000)throw Error('Bounded Sunny context exceeds 80000 bytes');return value;
}
function prompt(hub,task){const value=context(hub,task,{pending:true});return value?'<sunnyContext>'+JSON.stringify(value)+'</sunnyContext>\nCall sunny_status after binding before your first mutation. Use a new call ID and the returned expectedRevision after a stale rejection. Suite-execution checks establish technical execution only; reviewers must independently inspect semantic criterion fulfillment.':'';}
function authenticate(hub,p){
 if(!p||Object.keys(p).some(k=>!['threadId','turnId','callId','tool','arguments','namespace'].includes(k))||p.namespace!==undefined&&p.namespace!=='')throw Object.assign(Error('Invalid session envelope'),{code:'SESSION_NOT_BOUND'});
 for(const k of ['threadId','turnId','callId'])if(typeof p[k]!=='string'||!p[k].trim()||p[k].length>200||p[k].includes('\0'))throw Object.assign(Error('Invalid session identity'),{code:'SESSION_NOT_BOUND'});
 const tasks=hub.state.tasks.filter(t=>t.threadId===p.threadId),task=tasks[0],m=task&&membership(hub,task);
 if(tasks.length!==1||!m||task.external||m.run.id!==p.arguments?.runId||m.run.projectId!==p.arguments?.projectId)throw Object.assign(Error('Session is not bound to this run'),{code:'SESSION_NOT_BOUND'});
 if(!task.turnId||hub.pendingSessionBindings?.has(task.id)||m.role==='validation-coordinator'&&m.delivery.continuation.state==='pending'||!m.run.coordinator&&m.role!=='reviewer')throw Object.assign(Error('Session binding pending'),{code:'SESSION_BINDING_PENDING',retry:'sunny_status'});
 if(task.turnId!==p.turnId||!bound(hub,task,m)||hub.captain.stopping.has(task.id)||!names[m.role].includes(p.tool))throw Object.assign(Error('Session has changed or tool is unavailable'),{code:'SESSION_STALE'});
 return {task,...m};
}
async function status(hub,p){const {task}=authenticate(hub,p);if(Object.keys(p.arguments).length!==2)throw Error('Invalid status arguments');return {status:'current',context:context(hub,task)};}
async function invokeOnce(hub,p,operation){
 const auth=authenticate(hub,p),requestSha256=digest({tool:p.tool,args:p.arguments}),{task}=auth;
 const prior=(auth.run.protocolCalls||[]).find(c=>c.taskId===task.id&&c.threadId===p.threadId&&c.turnId===p.turnId&&c.callId===p.callId);
 if(prior){if(prior.requestSha256!==requestSha256)throw Error('Session call ID replay conflicts');return structuredClone(prior.response);}
 const accepted=[...(auth.run.coordinatorCalls||[]),...(auth.run.reviewCalls||[])].find(c=>c.taskId===task.id&&c.threadId===p.threadId&&c.turnId===p.turnId&&c.callId===p.callId);
 if(accepted){if(accepted.requestSha256!==(p.tool==='sunny_review'?digest(p.arguments):requestSha256))throw Error('Session call ID replay conflicts');return {...structuredClone(accepted.response),context:context(hub,task)};}
 const joined=(auth.run.deliveries||[]).flatMap(d=>(d.calls||[]).map(c=>({d,c}))).find(({c})=>c.taskId===task.id&&c.threadId===p.threadId&&c.turnId===p.turnId&&c.callId===p.callId);
 if(joined){if(joined.c.requestSha256!==requestSha256)throw Error('Session call ID replay conflicts');return {...(joined.c.response||await hub.delivery().wait(auth.run.id,joined.d.id,p.tool)),context:context(hub,task)};}
 const rejectStale=()=>hub.missionMutation(book=>{authenticate(hub,p);const run=book.data.runs.find(r=>r.id===auth.run.id);if((run.protocolCalls?.length||0)>=1000)throw Error('Session call limit reached');const response={status:'rejected',code:'STALE_REVISION',effectsStarted:false,context:context(hub,task)};(run.protocolCalls??=[]).push({taskId:task.id,threadId:p.threadId,turnId:p.turnId,callId:p.callId,requestSha256,response});return response;},'mission',{skipUnchanged:true});
 if(auth.run.revision!==p.arguments.expectedRevision)return rejectStale();
 try{const result=await operation(auth);let fresh;try{authenticate(hub,p);fresh=context(hub,task);}catch{/* An expired or stopped session receives no executable context. */}return {...result,...(fresh?{context:fresh}:{})};}catch(error){if(error.code==='STALE_REVISION')return rejectStale();throw error;}
}
async function invoke(hub,p,operation){
 const {task}=authenticate(hub,p),key=JSON.stringify([task.id,p.threadId,p.turnId,p.callId]),requestSha256=digest({tool:p.tool,args:p.arguments});hub.sunnyCalls??=new Map();const old=hub.sunnyCalls.get(key);if(old){if(old.requestSha256!==requestSha256)throw Error('Session call ID replay conflicts');return old.promise;}
 const entry={requestSha256,promise:null};hub.sunnyCalls.set(key,entry);entry.promise=Promise.resolve().then(()=>invokeOnce(hub,p,operation)).finally(()=>hub.sunnyCalls.delete(key));return entry.promise;
}
function errorResult(error){if(error.uncertain||error.durable||require('./persistence-barriers.cjs').storageUncertain(error))return {status:'unknown',code:'OUTCOME_UNKNOWN',message:error.message};return error.code?{status:'rejected',code:error.code,effectsStarted:false,...(error.retry?{retry:error.retry}:{}),message:error.message}:error.message;}
function currentReview(run,binding){return !!(run.ordinary&&binding&&run.currentEpoch?.id===binding.epochId&&run.verification?.reviewBinding&&sameSource(run.verification.reviewBinding,binding));}
module.exports={digest,names,statusTool,membership,context,prompt,authenticate,status,invoke,currentReview,errorResult};
