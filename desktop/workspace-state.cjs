const {emptyWorkspace,validateWorkspace}=require('./mission-profile.cjs');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key));
const id=value=>typeof value==='string'&&value.trim().length>0&&value.length<=200&&!value.includes('\0');
const revision=value=>Number.isSafeInteger(value)&&value>=0;
const has=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);

function validateWorkspaceDraft(draft){validateWorkspace({...emptyWorkspace(),drafts:[draft]});}
function validateWorkspaceUpdate(update){
 if(!exact(update,['expectedRevision','context','draft','deleteDraft','seenAcceptanceId'])||!revision(update.expectedRevision))throw Error('Invalid workspace update.');
 if(has(update,'context'))validateWorkspace({...emptyWorkspace(),context:update.context});
 if(has(update,'draft'))validateWorkspaceDraft(update.draft);
 if(has(update,'deleteDraft')&&(!exact(update.deleteDraft,['id','expectedDraftRevision'])||!id(update.deleteDraft.id)||!revision(update.deleteDraft.expectedDraftRevision)))throw Error('Invalid workspace draft deletion.');
 if(has(update,'seenAcceptanceId')&&!id(update.seenAcceptanceId))throw Error('Invalid acceptance ID.');
 if(has(update,'draft')&&has(update,'deleteDraft'))throw Error('Cannot both write and delete a workspace draft.');
}
function conflict(current,message){const error=Error(message);error.code='WORKSPACE_CONFLICT';error.latestWorkspace=structuredClone(current);throw error;}
function references(reference,state){
 const projects=state.projects||[],tasks=state.tasks||[],missions=state.missions||[];
 return {project:projects.find(value=>value.id===reference.projectId),task:tasks.find(value=>value.id===reference.taskId),mission:missions.find(value=>value.id===reference.missionId),attempt:missions.flatMap(mission=>(mission.attempts||[]).map(attempt=>({mission,attempt}))).find(value=>value.attempt.id===reference.attemptId)};
}
function validateMembership(reference,state){
 const found=references(reference,state);
 const run=state.runs?.find(r=>r.id===reference.runId);if(run&&(run.projectId!==reference.projectId||found.mission&&found.mission.runId!==run.id))throw Error('Workspace run membership mismatch.');
 if(found.task&&found.task.projectId!==reference.projectId)throw Error('Workspace task project membership mismatch.');
 if(found.mission&&found.mission.projectId!==reference.projectId)throw Error('Workspace mission project membership mismatch.');
 if(found.attempt&&(found.attempt.mission.projectId!==reference.projectId||(reference.missionId!==undefined&&found.attempt.mission.id!==reference.missionId)))throw Error('Workspace attempt mission membership mismatch.');
 const worker=Boolean(found.task&&run&&found.task.runId===run.id&&run.assignments.some(a=>a.taskId===found.task.id)&&(!found.attempt||found.attempt.attempt.taskIds.includes(found.task.parentTaskId)));
 if(!worker&&found.task&&found.mission&&reference.attemptId===undefined&&!(found.mission.attempts||[]).some(attempt=>(attempt.taskIds||[]).includes(found.task.id)))throw Error('Workspace task mission membership mismatch.');
 if(!worker&&found.task&&found.attempt&&!(found.attempt.attempt.taskIds||[]).includes(found.task.id))throw Error('Workspace task attempt membership mismatch.');
}
function getWorkspaceReferenceAvailability(reference,state){
 const found=references(reference,state);return {project:Boolean(found.project),mission:Boolean(found.mission),attempt:Boolean(found.attempt),task:Boolean(found.task)};
}
function realAcceptance(acceptanceId,state){
 const matches=(state.missions||[]).filter(mission=>mission.acceptance?.id===acceptanceId);
 if(matches.length!==1)return false;
 const {acceptance,selectedResult}=matches[0];
 return acceptance.legacy!==true&&acceptance.actor==='captain'&&selectedResult&&acceptance.attemptId===selectedResult.attemptId&&acceptance.resultId===selectedResult.id&&/^[a-f0-9]{64}$/.test(acceptance.resultSha256)&&acceptance.resultSha256===selectedResult.ref?.sha256;
}
function applyWorkspaceUpdate(current,update,state){
 validateWorkspace(current);validateWorkspaceUpdate(update);
 if(current.revision!==update.expectedRevision)conflict(current,'Workspace revision changed. Reload the latest workspace and preserve your input.');
 const next=structuredClone(current);
 if(has(update,'context')){
  if(update.context!==null){validateMembership(update.context,state);if(update.context.returnTo.projectId!==undefined)validateMembership(update.context.returnTo,state);else if(update.context.returnTo.missionId!==undefined||update.context.returnTo.taskId!==undefined)validateMembership({...update.context.returnTo,projectId:update.context.projectId},state);}
  next.context=structuredClone(update.context);
 }
 if(has(update,'draft')){
  validateMembership(update.draft,state);
  const index=next.drafts.findIndex(value=>value.id===update.draft.id),stored=index<0?undefined:next.drafts[index];
  if(update.draft.revision!==(stored?.revision||0))conflict(current,'Workspace draft revision changed. Preserve your newer input.');
  const draft={...structuredClone(update.draft),revision:update.draft.revision+1};
  if(index<0)next.drafts.push(draft);else next.drafts[index]=draft;
 }
 if(has(update,'deleteDraft')){
  const index=next.drafts.findIndex(value=>value.id===update.deleteDraft.id);
  if(index<0||next.drafts[index].revision!==update.deleteDraft.expectedDraftRevision)conflict(current,'Workspace draft revision changed. Preserve your newer input.');
  next.drafts.splice(index,1);
 }
 if(has(update,'seenAcceptanceId')){
  if(!realAcceptance(update.seenAcceptanceId,state))throw Error('Acceptance receipt is unavailable.');
  if(!next.seenAcceptanceIds.includes(update.seenAcceptanceId))next.seenAcceptanceIds.push(update.seenAcceptanceId);
 }
 next.revision++;validateWorkspace(next);return next;
}
// A successful claim is a candidate only: the caller must persist it before playback.
function claimAcceptanceCue(current,input,state){
 validateWorkspace(current);
 if(!exact(input,['acceptanceId'])||!id(input.acceptanceId))throw Error('Invalid acceptance cue claim.');
 if(state.settings?.reducedMotion||current.seenAcceptanceIds.includes(input.acceptanceId)||current.seenAcceptanceIds.length>=500||!realAcceptance(input.acceptanceId,state))return {workspace:structuredClone(current),play:false};
 return {workspace:applyWorkspaceUpdate(current,{expectedRevision:current.revision,seenAcceptanceId:input.acceptanceId},state),play:true};
}
module.exports={applyWorkspaceUpdate,validateWorkspaceUpdate,validateWorkspaceDraft,getWorkspaceReferenceAvailability,claimAcceptanceCue};
