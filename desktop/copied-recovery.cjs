const path=require('node:path');
const tokens=new WeakSet(),issued=new WeakSet(),installed=new WeakSet(),reopened=new WeakSet(),hubs=new WeakMap();
const failure=code=>Object.assign(Error(code),{code});
function assertCopiedToken(token){if(!token||!tokens.has(token))throw failure('COPIED_CAPABILITY_REQUIRED');return token;}
function issueCopiedRecovery(fixture){
 require('./packaged-acceptance.cjs').assertCopiedFixtureCapability(fixture);
 if(fixture.scenario!=='stopped-profile-copy'||fixture.phase!==1||fixture.mib!==1||issued.has(fixture))throw failure('COPIED_CAPABILITY_REQUIRED');
 issued.add(fixture);const token=Object.freeze({});tokens.add(token);return token;
}
function installCopiedRecovery(hub,token){assertCopiedToken(token);if(installed.has(token)||hubs.has(hub))throw failure('COPIED_CAPABILITY_REQUIRED');installed.add(token);hubs.set(hub,token);}
function isCopiedRecovery(hub){return hubs.has(hub);}
function renewCopiedRecovery(hub){if(!hubs.has(hub)||hub.closed!==true||reopened.has(hub))throw failure('COPIED_CAPABILITY_REQUIRED');reopened.add(hub);const token=Object.freeze({});tokens.add(token);return token;}
function preservePassiveState(hub,saved){
 if(!isCopiedRecovery(hub))throw failure('COPIED_CAPABILITY_REQUIRED');
 // Ordinary startup's display-oriented memory cap and resident roster are not
 // lossless storage transforms. This inert copied Hub never learns/schedules.
 if(saved.growth!==undefined){hub.growth.data=structuredClone(saved.growth);hub.state.growth=hub.growth.data;}
 if(saved.news!==undefined)hub.state.news=structuredClone(saved.news);
 if(saved.world!==undefined)hub.state.world={...structuredClone(saved.world),paused:true,jobs:hub.state.world.jobs};
}
function denyExternal(hub){if(isCopiedRecovery(hub))throw failure('COPIED_EXTERNAL_ACCESS_DENIED');}
function reservationKey(root){
 if(typeof root!=='string'||root.length>4096||root.includes('\0')||!(/^[a-z]:[\\/]/i.test(root)||/^\\\\[^\\]+\\[^\\]+/.test(root))||/^\\\\[?.]\\/.test(root))throw failure('COPIED_RESERVATION_INVALID');
 return path.win32.normalize(root).toLowerCase();
}
function exactly(records,id){const matches=records.filter(record=>record.id===id);if(matches.length!==1)throw failure('COPIED_RESERVATION_INVALID');return matches[0];}
function savedRoot(state,selection){
 const project=exactly(state.projects,selection.projectId),task=selection.taskId?exactly(state.tasks,selection.taskId):undefined;
 if(task&&task.projectId!==project.id)throw failure('COPIED_RESERVATION_INVALID');
 const missions=task&&!task.runId?state.missions.filter(m=>m.runId&&m.projectId===project.id&&(m.taskIds.includes(task.id)||m.attempts.some(a=>a.taskId===task.id))):[];
 if(missions.length>1)throw failure('COPIED_RESERVATION_INVALID');
 const runId=selection.runId||task?.runId||missions[0]?.runId,workspaceId=selection.workspaceId||task?.workspaceId;
 if(task?.runId&&selection.runId&&task.runId!==selection.runId||task?.workspaceId&&selection.workspaceId&&task.workspaceId!==selection.workspaceId)throw failure('COPIED_RESERVATION_INVALID');
 if(!runId&&!workspaceId)return project.path;
 const run=exactly(state.runs,runId);if(run.projectId!==project.id)throw failure('COPIED_RESERVATION_INVALID');
 let ref;if(selection.integration||missions.length){const refs=run.workspaces.filter(w=>w.integration===true);if(refs.length!==1)throw failure('COPIED_RESERVATION_INVALID');ref=refs[0];}else ref=exactly(run.workspaces,workspaceId);
 if(ref.runId!==run.id||ref.projectId!==project.id)throw failure('COPIED_RESERVATION_INVALID');
 if(task?.runId){const continuation=require('./mission-delivery.cjs').continuationFor(run,task);if(continuation){if(task.deliveryId!==continuation.id||ref.id!==continuation.continuation.workspaceId||!ref.integration)throw failure('COPIED_RESERVATION_INVALID');}else{const assignment=exactly(run.assignments,task.assignmentId);if(ref.assignmentId!==assignment.id||assignment.taskId!==task.id||assignment.workspaceId!==ref.id)throw failure('COPIED_RESERVATION_INVALID');}}
 return ref.canonicalRoot;
}
function reserveSaved(hub,id,selection){
 if(!isCopiedRecovery(hub))throw failure('COPIED_CAPABILITY_REQUIRED');
 const task=hub.state.tasks.find(t=>t.id===selection.taskId),mission=task&&!task.runId?hub.state.missions.find(m=>m.runId&&m.taskIds.includes(task.id)):undefined;
 const scope={projectId:selection.projectId,runId:selection.runId||task?.runId||mission?.runId,...(selection.integration?{integrating:true}:{})};
 // If a malformed relationship aborts admission, uncertainty is still retained
 // in the in-memory gate. No guessed workspace or empty root is substituted.
 hub.gate.logical.set(id,scope);
 try{const root=savedRoot(hub.state,selection);hub.gate.reserve(id,root,scope);return root;}catch{
  const project=hub.state.projects.find(p=>p.id===selection.projectId);if(project)try{hub.gate.reserve(id,project.path,scope);}catch{/* Logical identity remains fenced. */}
  throw failure('COPIED_RESERVATION_INVALID');
 }
}
module.exports={issueCopiedRecovery,assertCopiedToken,installCopiedRecovery,isCopiedRecovery,renewCopiedRecovery,preservePassiveState,denyExternal,reservationKey,reserveSaved};
