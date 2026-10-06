const {randomUUID}=require('node:crypto');
const {digest}=require('./mission-context.cjs');
const {sameSource}=require('./review-verdicts.cjs');
const waves=require('./production-waves.cjs');
const {storageUncertain}=require('./persistence-barriers.cjs');
const fail=code=>Object.assign(Error(code),{code});
function identity(ref){return digest({ref,metadata:require('./execution-workspaces.cjs').metadataSignature(ref)});}
function awaitingContribution(hub,run,waveIds){
 const service=hub.integration(),policy=require('./conflict-resolution.cjs');
 const waiting=(run.integrations||[]).filter(op=>{const control=service.commands.get(op.id),a=run.assignments.find(a=>a.id===op.resolution?.assignmentId);return waveIds.includes(op.assignmentId)&&['prepared','applying'].includes(op.resolution?.state)&&service.resolutions.inflight.has(op.id)&&policy.binding(run,a)===op&&control?.runId===run.id&&!control.recovered&&!control.cancelRequested&&['completed','running'].includes(control.state)&&control.reservationId==='integration:'+op.id&&hub.gate.active.has(control.reservationId);});
 if(!waiting.length)return false;const allowed=new Set(['task:'+waves.delivery(run)?.caller.taskId,...waiting.map(op=>'effect:'+op.id)]);return require('./run-control.cjs').report(hub,run.id).unknownEffects.every(id=>allowed.has(id));
}
function quiescent(hub,run,d,{checkId}={}){
 const ids=waves.prefixIds(run,d),future=run.currentEpoch.productionWaves.waves.slice(d.productionWave.active+1).flat();
 if(future.some(id=>{const a=run.assignments.find(a=>a.id===id);return a.state!=='queued'||a.taskId||a.workspaceId||a.launchReservationId||a.checkpointBinding;}))throw fail('CHECKPOINT_FUTURE_STARTED');
 const report=require('./run-control.cjs').report(hub,run.id),allowed=new Set(['task:'+d.caller.taskId,...(checkId?['effect:'+checkId]:[])]);
 if(report.unknownEffects.some(id=>!allowed.has(id)))throw Object.assign(fail('CHECKPOINT_NOT_QUIESCENT'),{uncertain:true});
 for(const id of ids){const a=run.assignments.find(a=>a.id===id),task=hub.state.tasks.find(t=>t.id===a?.taskId);if(a?.state!=='finished'||task?.status!=='finished'||!a.sourceResult||hub.hasTaskRecoveryIntent(task)||hub.gate.active.has(task.id)||hub.pendingSessionBindings?.has(task.id))throw fail('CHECKPOINT_NOT_QUIESCENT');}
 if(!require('./mission-integration.cjs').provenance(run,hub.state.tasks).authorshipComplete)throw fail('CHECKPOINT_AUTHOR_HISTORY');
 return ids.map(id=>{const a=run.assignments.find(a=>a.id===id);return {id,taskId:a.taskId,workspaceId:a.workspaceId,source:structuredClone(a.sourceResult)};});
}
async function predecessorSources(hub,runId,prefix){
 for(const item of prefix){const run=hub.integration().run(runId),a=run.assignments.find(a=>a.id===item.id),task=hub.state.tasks.find(t=>t.id===item.taskId);if(a?.state!=='finished'||a.taskId!==item.taskId||a.workspaceId!==item.workspaceId||!sameSource(a.sourceResult,item.source)||task?.status!=='finished')throw fail('CHECKPOINT_PREDECESSOR_CHANGED');const actual=await hub.captureAssignmentOutcome(task,{allowTransferred:true,requireClean:true});if(!sameSource(actual,item.source))throw fail('CHECKPOINT_PREDECESSOR_CHANGED');}
}
async function prefixProof(hub,run,d,source){
 const ids=waves.prefixIds(run,d),contributions=(run.integrations||[]).map(op=>require('./conflict-resolution.cjs').contribution(run,op));
 if(contributions.some(c=>!c||c.assignments.some(id=>!ids.includes(id))))return false;
 for(const id of ids){const a=run.assignments.find(a=>a.id===id);if(waves.author(a)&&(!a.sourceResult||a.state!=='finished'||a.sourceResult.headCommit!==a.baseCommit&&!contributions.some(c=>c.assignments.includes(id))))return false;}
 return require('./mission-verification.cjs').integrationChainProof(hub,run,source);
}
function assertOperation(hub,runId,deliveryId,operation){const {run,delivery:d}=hub.delivery().find(runId,deliveryId);hub.delivery().assertCurrent(run,d);hub.integration().admission(run);if(d.stage!=='checkpoint'||d.generation!==operation.generation||!sameSource({...d.productionWave.operation,checkIds:[]},{...operation,checkIds:[]})||operation.graphDigest!==run.currentEpoch.productionWaves.digest||operation.checkPlanDigest!==run.ordinary.checkPlan.digest)throw fail('CHECKPOINT_OPERATION_CHANGED');return {run,d};}
async function validateWorkspace(hub,runId,assignmentId){
 let run=hub.integration().run(runId),a=run.assignments.find(a=>a.id===assignmentId);hub.assertAssignmentBinding({runId,assignmentId});if(!waves.binding(run,a))throw fail('CHECKPOINT_BINDING_CHANGED');const d=waves.delivery(run),cp=d.productionWave.checkpoints.find(c=>c.id===a.checkpointBinding.checkpointId),project=hub.runSourceProject(runId),ref=project.executionWorkspace,stamp=cp.workspaceIdentity;
 await hub.assertExecutionProject(project);if(ref.id!==cp.workspaceId||identity(ref)!==stamp)throw fail('CHECKPOINT_ROOT_CHANGED');const actual=await hub.integration().source(ref);run=hub.integration().run(runId);a=run.assignments.find(a=>a.id===assignmentId);hub.assertAssignmentBinding({runId,assignmentId});if(!waves.binding(run,a)||actual.dirty||!sameSource(actual.source,cp.source)||identity(hub.runSourceProject(runId).executionWorkspace)!==stamp)throw fail('CHECKPOINT_SOURCE_CHANGED');
}
async function advance(delivery,runId,deliveryId){
 const hub=delivery.hub,service=hub.integration();let {run,delivery:d}=delivery.find(runId,deliveryId);delivery.assertCurrent(run,d);
 if(require('./repair-policy.cjs').repairExhausted(run))throw fail('FINAL_REPAIR_WITH_FUTURE_PRODUCTION');
 service.admission(run);
 // A reopened or partially acknowledged transaction has no automatic replay path.
 if(d.productionWave.operation)throw fail('CHECKPOINT_RECONCILIATION_REQUIRED');
 const prefix=quiescent(hub,run,d),project=hub.runSourceProject(runId),workspace=project.executionWorkspace,lock='checkpoint:'+randomUUID(),lifecycle={};
 hub.gate.acquire(lock,project.path,{projectId:run.projectId,runId,integrating:true});let operation;
 try{
  const first=await service.source(workspace);({run,delivery:d}=delivery.find(runId,deliveryId));delivery.assertCurrent(run,d);quiescent(hub,run,d);if(first.dirty)throw fail('CHECKPOINT_SOURCE_CHANGED');await predecessorSources(hub,runId,prefix);if(!await prefixProof(hub,run,d,first.source))throw fail('CHECKPOINT_PREFIX_PROOF_INVALID');
  operation={version:1,id:randomUUID(),epochId:d.epochId,deliveryId:d.id,generation:d.generation+1,wave:d.productionWave.active,graphDigest:run.currentEpoch.productionWaves.digest,checkPlanDigest:d.checkPlanDigest,prefix,integrationIds:(run.integrations||[]).map(op=>op.id),checkIds:[],successorIds:[...run.currentEpoch.productionWaves.waves[d.productionWave.active+1]],source:first.source,workspaceId:workspace.id,workspaceIdentity:identity(workspace),state:'pending'};
  const beforeRevision=service.run(runId).revision,beforeGeneration=d.generation;
  const validateIntent=async()=>{const current=delivery.find(runId,deliveryId);delivery.assertCurrent(current.run,current.delivery);service.admission(current.run);if(current.run.revision!==beforeRevision||current.delivery.generation!==beforeGeneration||current.delivery.productionWave.operation)throw fail('STALE_OPERATION');quiescent(hub,current.run,current.delivery);await sourceGuard();};
  async function sourceGuard(){const actual=await service.source(workspace);if(actual.dirty||!sameSource(actual.source,operation.source)||identity(hub.runSourceProject(runId).executionWorkspace)!==operation.workspaceIdentity)throw fail('CHECKPOINT_SOURCE_CHANGED');}
  await hub.missionMutation(book=>{const r=book.data.runs.find(r=>r.id===runId),current=r.deliveries.find(v=>v.id===deliveryId);if(r.revision!==beforeRevision||current.generation!==beforeGeneration)throw fail('STALE_OPERATION');current.productionWave.operation=operation;current.stage='checkpoint';current.generation++;r.phase='validating';r.revision++;},'mission',{validate:validateIntent});
  const validate=async()=>{let current=assertOperation(hub,runId,deliveryId,operation);require('./mission-check-plan.cjs').assertRecipes(project.path,current.run.ordinary.checkPlan,current.run.criteria);quiescent(hub,current.run,current.d,{checkId:lifecycle.pending?.id});await sourceGuard();current=assertOperation(hub,runId,deliveryId,operation);quiescent(hub,current.run,current.d,{checkId:lifecycle.pending?.id});};
  for(const kind of [...new Set(run.ordinary.checkPlan.entries.map(e=>e.kind))]){
   const {execution,result}=await require('./mission-check-effects.cjs').execute(hub,{runId,project,workspace,source:operation.source,kind,lock,validate,lifecycle});
   const criterionIds=require('./mission-check-plan.cjs').coverage(run.ordinary.checkPlan,kind,result,operation.source);
   await require('./mission-check-effects.cjs').complete(hub,{runId,execution,result,criterionIds,validate,lifecycle,checkpointId:operation.id});
   if(result.status!=='passed'||!criterionIds.length)throw fail('CHECKPOINT_CHECKS_FAILED');
  }
  await validate();await predecessorSources(hub,runId,prefix);await validate();({run,delivery:d}=delivery.find(runId,deliveryId));
  const capturedRevision=run.revision,capturedGeneration=d.generation,cp={...structuredClone(d.productionWave.operation),state:'completed'};cp.digest=digest(cp);
  if(!await prefixProof(hub,run,d,cp.source))throw fail('CHECKPOINT_PREFIX_PROOF_INVALID');
  const graph=require('./assignment-graph.cjs'),transfers=new Map();
  for(const id of cp.successorIds){const next=run.assignments.find(a=>a.id===id),ancestors=graph.ancestors(next,new Map(run.assignments.map(a=>[a.id,a]))),receipts=[];
   for(const item of prefix){const old=run.assignments.find(a=>a.id===item.id);if(waves.author(next)&&ancestors.has(old.id)&&next.ownedPaths.some(x=>old.ownedPaths.some(y=>graph.overlap(graph.normalized(x),graph.normalized(y)))))receipts.push(waves.transferReceipt(hub,run,old,next,cp.source.headCommit,item.source));}transfers.set(id,receipts);
  }
  const validateBatch=async()=>{await validate();const current=service.run(runId),d=current.deliveries.find(d=>d.id===deliveryId);if(current.revision!==capturedRevision||d.generation!==capturedGeneration||!sameSource(d.productionWave.operation.checkIds,cp.checkIds))throw fail('STALE_OPERATION');await predecessorSources(hub,runId,prefix);await validate();};
  await hub.missionMutation(book=>{const r=book.data.runs.find(r=>r.id===runId),current=r.deliveries.find(v=>v.id===deliveryId);if(r.revision!==capturedRevision||current.generation!==capturedGeneration)throw fail('STALE_OPERATION');
   for(const id of cp.successorIds){const a=r.assignments.find(a=>a.id===id);if(a.state!=='queued'||a.taskId||a.workspaceId||a.launchReservationId||a.checkpointBinding)throw fail('CHECKPOINT_FUTURE_STARTED');a.baseCommit=cp.source.headCommit;a.checkpointBinding={version:1,epochId:d.epochId,deliveryId:d.id,checkpointId:cp.id,generation:cp.generation,digest:cp.digest,wave:cp.wave+1,workspaceId:cp.workspaceId,workspaceIdentity:cp.workspaceIdentity,sourceHead:cp.source.headCommit};if(transfers.get(id).length)a.ownershipTransfers=transfers.get(id);}
   current.productionWave.checkpoints.push(cp);delete current.productionWave.operation;current.productionWave.active++;current.generation++;current.stage='collecting';r.phase='waiting';r.readiness=null;delete r.verification;r.revision++;
  },'mission',{validate:validateBatch});hub.gate.release(lock);hub.wakeCrewScheduler(runId);
 }catch(error){
  const {pending,intentDurable}=lifecycle,current=service.run(runId),record=pending&&current.combinedChecks?.find(c=>c.id===pending.id);
  if(pending&&(intentDurable||record||storageUncertain(error)||error.durable)){const retained=record||{...pending};if(!record)(current.combinedChecks??=[]).push(retained);retained.state='unknown';const control=service.commands.get(pending.id)||{id:pending.id,reservationId:lock,runId,workspaceId:workspace.id,kind:'check',exited:false};control.state='unknown';service.commands.set(pending.id,control);current.phase='unknown';hub.markDirty();try{await hub.persist('mission');}catch{}error.uncertain=true;}
  else if(storageUncertain(error)||error.durable){hub.gate.reserve(lock,project.path,{projectId:run.projectId,runId,integrating:true});error.uncertain=true;}
  else hub.gate.release(lock);throw error;
 }
}
module.exports={advance,validateWorkspace,quiescent,predecessorSources,awaitingContribution};
