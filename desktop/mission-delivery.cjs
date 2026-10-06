const {randomUUID}=require('node:crypto');
const protocol=require('./mission-context.cjs');
const {sameSource}=require('./review-verdicts.cjs');
const registry=require('./crew-registry.cjs');
const bounded={type:'string',minLength:1,maxLength:200};
const base={runId:bounded,projectId:bounded,expectedRevision:{type:'integer',minimum:0}};
const deliverTool={type:'function',name:'sunny_deliver',description:'Wait boundedly for main to integrate actual production outcomes and freeze your reply candidate. Complete your real turn after the receipt.',inputSchema:{type:'object',additionalProperties:false,required:[...Object.keys(base),'missionId','attemptId','producerAssignmentId','result'],properties:{...base,missionId:bounded,attemptId:bounded,producerAssignmentId:bounded,result:{type:'object',additionalProperties:false,required:['kind'],properties:{kind:{const:'reply'}}}}}};
const validateTool={type:'function',name:'sunny_validate',description:'Run the pinned project suite and await all exact independent reviewers. Complete your real turn after the outcome.',inputSchema:{type:'object',additionalProperties:false,required:[...Object.keys(base),'continuationId'],properties:{...base,continuationId:bounded}}};
const author=a=>['implementation','design','creative','operations'].includes(a?.capability);
function graphDigest(run,d){return protocol.digest([...d.productionIds,...d.reviewAssignmentIds].map(id=>{const a=run.assignments.find(a=>a.id===id);if(!a)return null;const fields=['id','crewId','roleId','capability','ownedPaths','dependencies','criteriaIds',...(d.productionIds.includes(id)?['objective','baseCommit']:[])];return Object.fromEntries(fields.map(k=>[k,a[k]]));}));}
function fail(code,message=code){return Object.assign(Error(message),{code});}
function partition(run,assignments,world){
 const reviewers=assignments.filter(registry.reviewAssignment),production=assignments.filter(a=>!registry.reviewAssignment(a)),authors=production.filter(author);
 if(!authors.length||production.some(a=>a.improvementTriggerId))throw fail('GRAPH_PARTITION_UNSATISFIABLE');
 const ids=new Set(run.criteria.map(c=>c.id));if(!reviewers.length||[...ids].some(id=>!reviewers.some(a=>a.criteriaIds.includes(id))))throw fail('GRAPH_REVIEW_COVERAGE_MISSING');
 for(const a of reviewers){if(a.ownedPaths.length||!a.criteriaIds.length||a.dependencies.some(id=>!production.some(a=>a.id===id)))throw fail('GRAPH_PARTITION_UNSATISFIABLE');registry.assertWorkerBinding(registry.crewBinding(a.crewId,world));}
 const ancestors=a=>{const found=new Set(),visit=item=>{for(const id of item.dependencies){if(found.has(id))continue;found.add(id);const prior=assignments.find(a=>a.id===id);if(prior)visit(prior);}};visit(a);return found;};
 const norm=p=>p.replaceAll('\\','/').replace(/\/$/,'').toLowerCase();
 for(const a of production){const closure=ancestors(a);if(reviewers.some(r=>closure.has(r.id)))throw fail('GRAPH_PARTITION_UNSATISFIABLE');if(authors.some(r=>closure.has(r.id)))throw fail('GRAPH_CHECKPOINT_WAVE_UNSUPPORTED');}
 for(let i=0;i<authors.length;i++)for(const b of authors.slice(i+1))if(authors[i].ownedPaths.some(p=>b.ownedPaths.some(q=>{p=norm(p);q=norm(q);return p===q||p.startsWith(q+'/')||q.startsWith(p+'/');})))throw fail('GRAPH_CHECKPOINT_WAVE_UNSUPPORTED');
 if(assignments.filter(a=>!a.launchReservationId&&!a.taskId).length+1>run.grant.maxLaunches-run.counters.launches)throw fail('GRAPH_REVIEW_BUDGET_INSUFFICIENT');
 if(assignments.some(a=>a.baseCommit!==run.ordinary.checkpoint.headCommit))throw fail('GRAPH_CHECKPOINT_CHANGED');
 return {productionIds:production.map(a=>a.id),reviewAssignmentIds:reviewers.map(a=>a.id)};
}
class MissionDelivery {
 constructor(hub){this.hub=hub;this.pumps=new Map();this.waiters=new Set();this.sealed=false;}
 find(runId,id){const run=this.hub.state.runs.find(r=>r.id===runId),delivery=run?.deliveries?.find(d=>d.id===id);if(!delivery)throw fail('DELIVERY_NOT_FOUND');return {run,delivery};}
 assertCurrent(run,d){
  if(this.sealed||this.hub.closed||this.hub.quiescing)throw fail('HUB_CLOSING');
  if(!this.hub.client.connected)throw fail('CONNECTION_LOST');
  if(run.phase==='unknown')throw fail('OUTCOME_UNKNOWN');
  if(run.stopIntent||run.controlIntent?.state==='pending'||['paused','stopping','stopped'].includes(run.phase))throw fail(run.phase==='paused'?'PAUSED':'STOP_REQUESTED');
  if(run.currentEpoch?.id!==d.epochId||run.currentEpoch.missionId!==d.missionId||protocol.digest(run.criteria)!==d.criteriaDigest||protocol.digest(run.grant)!==d.grantDigest||run.ordinary.checkPlan.digest!==d.checkPlanDigest||graphDigest(run,d)!==d.graphDigest)throw fail('STALE_OPERATION');
  const production=['collecting','integrating'].includes(d.stage),validation=['validation-bound','validating','awaiting-review'].includes(d.stage);if(production||validation){const actor=production?d.caller:d.continuation,t=this.hub.state.tasks.find(t=>t.id===actor?.taskId);if(t?.status==='unknown'||t&&this.hub.hasTaskRecoveryIntent(t))throw fail('OUTCOME_UNKNOWN');if(!t||t.threadId!==actor.threadId||t.turnId!==actor.turnId||!['working','waiting'].includes(t.status)&&!(validation&&d.stage==='awaiting-review'&&d.validationOutcome==='approved'&&t.status==='finished'))throw fail(production?'PRODUCTION_COORDINATOR_ENDED_EARLY':'VALIDATION_COORDINATOR_ENDED_EARLY');}
  const mission=this.hub.missionBook.get(d.missionId);if(mission.activeAttemptId!==d.attemptId||d.selectedResult&&(mission.selectedResult?.id!==d.selectedResult.id||mission.selectedResult.ref.sha256!==d.selectedResult.sha256))throw fail('STALE_OPERATION');
 }
 async change(runId,id,mutate){return this.hub.missionMutation(book=>{const run=book.data.runs.find(r=>r.id===runId),d=run.deliveries.find(d=>d.id===id);mutate(d,run);d.generation++;run.revision++;return structuredClone(d);});}
 async call(p){
  const h=this.hub,{run,task,delivery:boundDelivery}=protocol.authenticate(h,p),args=require('./supervision-commands.cjs').validateSupervisionCommand(p.tool,p.arguments);let d,admitted=false;const callRecord={taskId:task.id,threadId:p.threadId,turnId:p.turnId,callId:p.callId,tool:p.tool,requestSha256:protocol.digest({tool:p.tool,args:p.arguments})};
  if(p.tool==='sunny_deliver'){
   const descriptor={missionId:args.missionId,attemptId:args.attemptId,producerAssignmentId:args.producerAssignmentId,result:args.result};
   d=run.deliveries?.find(d=>d.epochId===run.currentEpoch.id);
   if(d){if(!sameSource(d.descriptor,descriptor)||d.caller.taskId!==task.id)throw fail('DELIVERY_DESCRIPTOR_CHANGED');}
   else{
    const parts=partition(run,run.assignments.filter(a=>run.currentEpoch.assignmentIds.includes(a.id)),h.state.world),producer=run.assignments.find(a=>a.id===args.producerAssignmentId);
    if(run.currentEpoch.missionId!==args.missionId||run.currentEpoch.id!==args.attemptId||!parts.productionIds.includes(producer?.id)||!author(producer))throw fail('DELIVERY_PRODUCER_CHANGED');
    d={version:1,id:randomUUID(),missionId:args.missionId,attemptId:args.attemptId,epochId:run.currentEpoch.id,caller:{taskId:task.id,threadId:p.threadId,turnId:p.turnId},requestSha256:protocol.digest(descriptor),descriptor,...parts,criteriaDigest:protocol.digest(run.criteria),checkPlanDigest:run.ordinary.checkPlan.digest,grantDigest:protocol.digest(run.grant),stage:'collecting',generation:0,operationIds:[],calls:[callRecord],graphDigest:graphDigest(run,parts)};
    await h.missionMutation(book=>{protocol.authenticate(h,p);const r=book.data.runs.find(r=>r.id===run.id);if(r.revision!==args.expectedRevision||r.deliveries?.some(x=>x.epochId===d.epochId))throw fail('STALE_REVISION');(r.deliveries??=[]).push(d);r.revision++;});admitted=true;
   }
  }else if(p.tool==='sunny_validate'){
   d=boundDelivery;if(!d||d.continuation?.id!==args.continuationId||d.continuation.taskId!==task.id)throw fail('CONTINUATION_CHANGED');
   if(d.stage==='validation-bound'){await this.change(run.id,d.id,(d,r)=>{if(r.revision!==args.expectedRevision)throw fail('STALE_REVISION');d.stage='validating';(d.calls??=[]).push(callRecord);});admitted=true;}
  }else throw fail('SESSION_STALE');
  this.assertCurrent(this.find(run.id,d.id).run,this.find(run.id,d.id).delivery);
  if(!admitted)await this.change(run.id,d.id,(d,r)=>{if(r.revision!==args.expectedRevision)throw fail('STALE_REVISION');if((d.calls?.length||0)>=1000)throw fail('DELIVERY_CALL_LIMIT');(d.calls??=[]).push(callRecord);});
  const waiting=this.wait(run.id,d.id,p.tool);this.wake(run.id);const result=await waiting;if(!this.sealed&&!h.quiescing&&!h.closed)await this.change(run.id,d.id,d=>{d.calls.find(c=>c.taskId===task.id&&c.callId===p.callId).response=structuredClone(result);});return result;
 }
 outcome(runId,id,tool){const {delivery:d}=this.find(runId,id);if(d.stage==='unknown')return {status:'unknown',code:d.reasonCode||'OUTCOME_UNKNOWN',operationId:id};if(d.stage==='blocked')return {status:'blocked',code:d.reasonCode,operationId:id};if(tool==='sunny_deliver'&&d.candidate)return {status:'delivered',operationId:id,candidate:structuredClone(d.candidate),source:structuredClone(d.source)};if(tool==='sunny_validate'&&d.validationOutcome==='approved')return {status:'validated',operationId:id,continuationId:d.continuation.id};return null;}
 wait(runId,id,tool){return new Promise(resolve=>{const entry={runId,id,tool,resolve,timer:null};entry.finish=value=>{if(!this.waiters.delete(entry))return;clearTimeout(entry.timer);resolve(value);};this.waiters.add(entry);entry.timer=setTimeout(()=>entry.finish({status:'pending',operationId:id,reasonCode:'AWAITING_DURABLE_OUTCOME'}),30000);const current=this.outcome(runId,id,tool);if(current)entry.finish(current);if(this.sealed)entry.finish({status:'unknown',code:'HUB_CLOSING',operationId:id});});}
 settle(){for(const w of this.waiters){const value=this.outcome(w.runId,w.id,w.tool);if(value)w.finish(value);}}
 cancelLocalWaiters(code,runId){if(!runId)this.sealed=true;for(const w of this.waiters)if(!runId||w.runId===runId)w.finish({status:'unknown',code,operationId:w.id});}
 wake(runId){if(this.sealed||this.hub.closed||this.hub.quiescing)return;const old=this.pumps.get(runId);if(old){old.again=true;return;}const entry={again:false};this.pumps.set(runId,entry);setImmediate(()=>{const work=this.hub.trackOwnedOperation(async()=>{do{entry.again=false;for(const d of this.hub.state.runs.find(r=>r.id===runId)?.deliveries||[])if(!['completed','blocked','unknown'].includes(d.stage))try{await this.pump(runId,d.id);}catch(e){await this.block(runId,d.id,e);}this.settle();}while(entry.again&&!this.sealed);});entry.promise=work;work.catch(e=>this.hub.reportAsync(e)).finally(()=>{this.pumps.delete(runId);if(entry.again)this.wake(runId);});});}
 async block(runId,id,error){if(this.sealed||this.hub.quiescing)return;const unknown=error.uncertain||error.durable||require('./persistence-barriers.cjs').storageUncertain(error)||['OUTCOME_UNKNOWN','CONNECTION_LOST'].includes(error.code);if(unknown)for(const w of this.waiters)if(w.runId===runId&&w.id===id)w.finish({status:'unknown',code:'OUTCOME_UNKNOWN',operationId:id});await this.change(runId,id,(d,run)=>{d.stage=unknown?'unknown':'blocked';d.reasonCode=error.code||'DELIVERY_BLOCKED';d.reason=String(error.message).slice(0,2000);run.readiness=null;if(!run.stopIntent&&!['paused','stopping','stopped','unknown'].includes(run.phase))run.phase=unknown?'unknown':'blocked';for(const a of run.assignments)if(d.reviewAssignmentIds.includes(a.id)&&a.state==='queued'&&!a.taskId&&!a.launchReservationId)a.state='cancelled';});this.settle();const run=this.find(runId,id).run,d=this.find(runId,id).delivery;for(const a of run.assignments.filter(a=>d.reviewAssignmentIds.includes(a.id))){const task=this.hub.state.tasks.find(t=>t.id===a.taskId);if(task&&['starting','working','waiting'].includes(task.status))this.hub.trackOwnedOperation(()=>this.hub.interrupt(task.id,{wholeRun:true})).catch(e=>this.hub.reportAsync(e));}}
 async admissionFailed(runId,assignmentId,error){const run=this.hub.state.runs.find(r=>r.id===runId),d=run?.deliveries?.find(d=>[...d.productionIds,...d.reviewAssignmentIds].includes(assignmentId)&&!['completed','blocked','unknown'].includes(d.stage));if(d)await this.block(runId,d.id,Object.assign(error,{code:error.code||'ASSIGNMENT_ADMISSION_FAILED'}));}
 async pump(runId,id){
  const h=this.hub;let {run,delivery:d}=this.find(runId,id);this.assertCurrent(run,d);
  const refresh=()=>{({run,delivery:d}=this.find(runId,id));this.assertCurrent(run,d);};
  if(['collecting','integrating'].includes(d.stage)){
   const producer=h.state.tasks.find(t=>t.id===d.caller.taskId);if(!producer||producer.threadId!==d.caller.threadId||producer.turnId!==d.caller.turnId||!['working','waiting'].includes(producer.status))throw fail('PRODUCTION_COORDINATOR_ENDED_EARLY');
   const generated=(run.integrations||[]).filter(op=>d.productionIds.includes(op.assignmentId)).map(op=>op.resolution?.assignmentId).filter(Boolean),production=[...d.productionIds,...generated].map(id=>run.assignments.find(a=>a.id===id));
   if(production.some(a=>!a))throw fail('PRODUCTION_MEMBERSHIP_CHANGED');if(production.some(a=>a.state==='unknown'))throw fail('OUTCOME_UNKNOWN');if(production.some(a=>['failed','interrupted','cancelled'].includes(a.state)))throw fail('PRODUCTION_FAILED');
   if(production.some(a=>a.state!=='finished'||h.state.tasks.find(t=>t.id===a.taskId)?.status!=='finished'))return;
   if(h.state.tasks.some(t=>production.some(a=>a.taskId===t.id)&&h.hasTaskRecoveryIntent(t)))throw fail('OUTCOME_UNKNOWN');
   for(const assignmentId of d.productionIds){refresh();const a=run.assignments.find(a=>a.id===assignmentId);if(!author(a)||a.sourceResult?.headCommit===a.baseCommit)continue;
    const existing=run.integrations?.find(op=>op.assignmentId===a.id);if(existing){if(!require('./conflict-resolution.cjs').contribution(run,existing)){if(existing.state==='unknown'||existing.state==='pending')throw fail('OUTCOME_UNKNOWN');return;}continue;}
    if(require('./repair-policy.cjs').repairExhausted(run))throw fail('FINAL_REPAIR_WITH_UNINTEGRATED_PRODUCTION');
    await this.change(runId,id,d=>{d.stage='integrating';});refresh();const actual=await h.integration().source(h.runSourceProject(runId).executionWorkspace);refresh();if(actual.dirty)throw fail('SOURCE_CHANGED');
    const op=await h.integrateWorkerResult({runId,assignmentId:a.id,head:a.sourceResult.headCommit,expectedRevision:run.revision,expectedSource:actual.source});
    await this.change(runId,id,d=>{if(!d.operationIds.includes(op.id))d.operationIds.push(op.id);});if(op.state!=='completed')return;
   }
   refresh();const actual=await h.integration().source(h.runSourceProject(runId).executionWorkspace);refresh();if(actual.dirty)throw fail('SOURCE_CHANGED');let a=run.assignments.find(a=>a.id===d.descriptor.producerAssignmentId);const op=run.integrations?.find(op=>op.assignmentId===a.id),effective=op&&require('./conflict-resolution.cjs').contribution(run,op);if(effective?.assignments.length>1)a=run.assignments.find(a=>a.id===effective.assignments.at(-1))||a;
   const task=h.state.tasks.find(t=>t.id===a.taskId),message=task?.messages.findLast(m=>m.role==='assistant'&&m.text?.trim());if(task?.status!=='finished'||!message)throw fail('RESULT_MESSAGE_MISSING');
   const candidate={kind:'reply',taskId:task.id,messageId:message.id,sha256:require('node:crypto').createHash('sha256').update(message.text,'utf8').digest('hex')};await this.change(runId,id,d=>{d.stage='awaiting-production-completion';d.candidate=candidate;d.source=actual.source;});this.settle();return;
  }
  if(d.stage==='awaiting-production-completion'){
   const task=h.state.tasks.find(t=>t.id===d.caller.taskId);if(task?.status==='unknown')throw fail('OUTCOME_UNKNOWN');if(['working','waiting','starting'].includes(task?.status))return;if(task?.status!=='finished'||task.threadId!==d.caller.threadId||task.turnId!==d.caller.turnId||h.hasTaskRecoveryIntent(task))throw fail('PRODUCTION_COORDINATOR_FAILED');
   const actual=await h.integration().source(h.runSourceProject(runId).executionWorkspace);refresh();if(actual.dirty||!sameSource(actual.source,d.source))throw fail('SOURCE_CHANGED');const mission=h.missionBook.get(d.missionId);if(mission.attempts.find(a=>a.id===d.attemptId)?.status!=='finished')throw fail('ATTEMPT_NOT_FINISHED');
   const selected=await h.selectMissionResult({missionId:mission.id,revision:mission.revision,ref:d.candidate,producerTaskId:d.candidate.taskId});refresh();await this.change(runId,id,d=>{d.selectedResult={id:selected.selectedResult.id,sha256:selected.selectedResult.ref.sha256};d.stage='selected';});refresh();
  }
  if(d.stage==='selected'){
   if(h.state.tasks.filter(t=>t.captain&&['starting','working','waiting','unknown'].includes(t.status)).length>=3||h.sharedExecutionCapacity().available<=0)return;
   const continuation={id:randomUUID(),taskId:randomUUID(),executionId:randomUUID(),workspaceId:h.runSourceProject(runId).executionWorkspace.id,state:'pending'};
   await this.change(runId,id,(d,r)=>{d.continuation=continuation;d.stage='continuation-dispatch-intent';require('./run-control.cjs').archiveCoordinator(r);delete r.coordinator;r.phase='validating';});refresh();
   try{const task=await h.start({projectId:run.projectId,crewId:'luffy',title:'Validate '+h.missionBook.get(d.missionId).title,prompt:'Validate the exact selected result using sunny_status then sunny_validate. Complete this real turn only after the durable validation outcome. Human captain acceptance remains separate.'},{id:continuation.taskId,executionId:continuation.executionId,runId,deliveryId:id});refresh();await this.change(runId,id,(d,r)=>{if(task.status!=='working'||!task.threadId||!task.turnId)throw fail('CONTINUATION_NOT_BOUND');d.continuation={...d.continuation,state:'bound',threadId:task.threadId,turnId:task.turnId};d.stage='validation-bound';r.coordinator={taskId:task.id,threadId:task.threadId,turnId:task.turnId};});}
   catch(e){const task=h.state.tasks.find(t=>t.id===continuation.taskId);if(task?.status==='unknown'||h.providerCalls?.has(continuation.taskId)||e.uncertain||e.durable)throw Object.assign(e,{code:'OUTCOME_UNKNOWN',uncertain:true});throw Object.assign(e,{code:e.code||'CONTINUATION_ADMISSION_FAILED'});}return;
  }
  if(d.stage==='validating'){
   await h.verifyCombinedSource({runId,missionId:d.missionId,expectedRevision:run.revision});refresh();
   const e=run.verification;if(!e?.integrationVerified||!e.authorshipComplete||run.criteria.some(c=>c.requiredChecks.some(kind=>!e.checks.some(v=>v.criterionId===c.id&&v.kind===kind&&v.status==='passed'))))throw fail('CHECKS_FAILED');
   await this.change(runId,id,(d,r)=>{d.stage='awaiting-review';r.phase='reviewing';});h.wakeCrewScheduler(runId);return;
  }
  if(d.stage==='awaiting-review'){
   const reviews=d.reviewAssignmentIds.map(id=>run.assignments.find(a=>a.id===id));if(reviews.some(a=>!a))throw fail('REVIEW_ASSIGNMENT_MISSING');
   for(const a of reviews){const task=h.state.tasks.find(t=>t.id===a.taskId),verdict=run.reviews.findLast(v=>v.assignmentId===a.id&&sameSource(v.reviewBinding,run.verification?.reviewBinding));if(a.state==='unknown'||task?.status==='unknown')throw fail('OUTCOME_UNKNOWN');if(['failed','interrupted','cancelled','blocked'].includes(a.state)||verdict&&verdict.decision!=='approve'||task?.status==='finished'&&!verdict)throw fail('REVIEW_BLOCKED');if(verdict)require('./review-verdicts.cjs').validateReviewVerdict(verdict,{run,tasks:h.state.tasks,source:run.verification.source,authors:run.verification.authors});}
   if(!d.validationOutcome&&reviews.every(a=>a.state==='finished'&&h.state.tasks.find(t=>t.id===a.taskId)?.status==='finished')&&require('./review-verdicts.cjs').evaluateReadiness({run,...run.verification,reviews:run.reviews,tasks:h.state.tasks}).ready){await this.change(runId,id,d=>{d.validationOutcome='approved';});this.settle();}
   const task=h.state.tasks.find(t=>t.id===d.continuation.taskId);if(['working','waiting','starting'].includes(task?.status))return;if(task?.status==='unknown')throw fail('OUTCOME_UNKNOWN');refresh();if(task?.status!=='finished'||d.validationOutcome!=='approved')throw fail('VALIDATION_COORDINATOR_ENDED_EARLY');await this.change(runId,id,(d,r)=>{d.stage='completed';d.continuation.state='completed';require('./run-control.cjs').archiveCoordinator(r);});
  }
 }
}
function continuationFor(run,task){return run?.deliveries?.find(d=>d.continuation?.taskId===task.id&&d.continuation.executionId===task.executionId&&d.epochId===run.currentEpoch?.id);}
function continuationAllowance(run,deliveryId){const d=run?.deliveries?.find(d=>d.id===deliveryId&&d.epochId===run.currentEpoch?.id),conflict=run?.integrations?.at(-1);if(!d?.selectedResult||!d.continuation||!['continuation-dispatch-intent','validation-bound','validating','awaiting-review'].includes(d.stage)||!require('./conflict-resolution.cjs').completed(run)||!sameSource(conflict.resolution.finalSource,d.source))return false;const contributions=run.integrations.map(op=>require('./conflict-resolution.cjs').contribution(run,op));return d.productionIds.every(id=>{const a=run.assignments.find(a=>a.id===id);return a?.state==='finished'&&(!author(a)||a.sourceResult?.headCommit===a.baseCommit||contributions.some(c=>c.assignments.includes(id)));});}
function assertQuiescent(hub,mission){const run=hub.state.runs.find(r=>r.id===mission.runId);if(!run?.ordinary)return;const d=run.deliveries?.find(d=>d.epochId===mission.activeAttemptId);if(!d||d.stage!=='completed'||d.selectedResult?.id!==mission.selectedResult?.id||require('./run-control.cjs').report(hub,run.id).unknownEffects.length)throw fail('DELIVERY_NOT_QUIESCENT');}
module.exports={MissionDelivery,deliverTool,validateTool,partition,author,fail,continuationFor,continuationAllowance,assertQuiescent};
