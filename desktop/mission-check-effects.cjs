// Private local effect lifecycle shared by exhaustive final and exact-prefix checks.
// Callers supply guards from their own main-owned authority; no provider selects a command.
const {randomUUID}=require('node:crypto');
async function execute(hub,{runId,project,workspace,source,kind,lock,validate,lifecycle,operationId,runtimeIdentity,deliveryId}){
 await validate();const run=hub.integration().run(runId);if(require('./repair-policy.cjs').repairExhausted(run)&&!require('./feedback-epochs.cjs').allows(run,{operationId,deliveryId})&&!require('./conflict-resolution.cjs').completed(run))throw Error('Check is outside the finite completion entitlement');if(!run.grant.scope.activities.includes(kind==='typecheck'?'test':kind))throw Error('Combined check outside grant');
 if(operationId&&run.combinedChecks?.some(c=>c.id===operationId))throw Object.assign(Error('Fixed check operation cannot execute twice'),{code:'CHECK_REPLAY'});
 const execution={id:operationId||randomUUID(),workspaceId:workspace.id,source,criterionIds:[],kind,state:'pending',time:Date.now()};lifecycle.pending=execution;lifecycle.intentDurable=false;
 await hub.missionMutation(book=>{const r=book.data.runs.find(r=>r.id===runId);if((r.combinedChecks?.length||0)>=1000)throw Error('Combined check history full');(r.combinedChecks??=[]).push(execution);r.readiness=null;delete r.verification;r.revision++;},'check-intent',{validate});lifecycle.intentDurable=true;
 const control={id:execution.id,reservationId:lock,runId,workspaceId:workspace.id,kind:'check',state:'pending',exited:false,...(runtimeIdentity?{runtimeIdentity:structuredClone(runtimeIdentity)}:{})};hub.integration().commands.set(execution.id,control);
 const result=await hub.evidence.runCheck(project.path,kind,validate,control);await validate({receipt:true});
 if(!control.exited||control.state!=='completed')throw Object.assign(Error('Check process has no observed close'),{code:'CHECK_CLOSE_UNKNOWN',uncertain:true});
 return {execution,result};
}
async function complete(hub,{runId,execution,result,criterionIds,validate,lifecycle,checkpointId}){
 const completed={...execution,criterionIds,state:'completed',result};
 await hub.missionMutation(book=>{const r=book.data.runs.find(r=>r.id===runId),index=r.combinedChecks.findIndex(c=>c.id===execution.id);if(index<0||r.combinedChecks[index].state!=='pending')throw Error('Check receipt authority changed');r.combinedChecks[index]=completed;if(checkpointId){const d=r.deliveries.find(d=>d.productionWave?.operation?.id===checkpointId);if(!d)throw Error('Checkpoint operation changed');d.productionWave.operation.checkIds.push(execution.id);}r.revision++;},'reservation-release',{validate:()=>validate({receipt:true})});lifecycle.pending=undefined;hub.integration().commands.delete(execution.id);return completed;
}
module.exports={execute,complete};
