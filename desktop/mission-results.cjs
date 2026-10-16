const {createHash}=require('node:crypto');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&!!value.trim()&&value.length<=200&&!value.includes('\0');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function validateMissionResultRef(ref){
 const fields=ref?.kind==='reply'?['kind','taskId','messageId','sha256']:['deliverable','playable'].includes(ref?.kind)?['kind','artifactId','sha256']:[];
 if(!object(ref)||!fields.length||Object.keys(ref).length!==fields.length||Object.keys(ref).some(key=>!fields.includes(key))||!hash(ref.sha256)||(ref.kind==='reply'?(!id(ref.taskId)||!id(ref.messageId)):!id(ref.artifactId)))throw Error('Invalid mission result reference.');
 return {...ref};
}
function producerTask(mission,tasks,producerTaskId){
 const attempt=mission.attempts.find(value=>value.id===mission.activeAttemptId);
 if(!attempt||attempt.status!=='finished'||!attempt.taskIds.includes(producerTaskId)||!mission.taskIds.includes(producerTaskId))throw Error('Result producer must be a member of the finished active attempt.');
 const matches=tasks.filter(task=>task.id===producerTaskId);
 if(matches.length!==1)throw Error('Result producer task must be uniquely available.');
 const task=matches[0];
 if(task.external||task.status!=='finished'||task.projectId!==mission.projectId||(task.missionId!==undefined&&task.missionId!==mission.id)||(task.attemptId!==undefined&&task.attemptId!==attempt.id))throw Error('Result producer must be a finished local task in this project and attempt.');
 return task;
}
function inspectMissionResult({mission,tasks,ref,producerTaskId}){
 const resolvedRef=validateMissionResultRef(ref);
 if(mission.status!=='WAITING_FOR_REVIEW')throw Error('Mission is not ready for review.');
 if(producerTaskId!==undefined&&!id(producerTaskId))throw Error('Choose a valid result producer task.');
 if(resolvedRef.kind==='reply'){
  if(producerTaskId!==undefined&&producerTaskId!==resolvedRef.taskId)throw Error('Reply producer conflicts with its task reference.');
  producerTaskId=resolvedRef.taskId;const task=producerTask(mission,tasks,producerTaskId),messages=(task.messages||[]).filter(message=>message.id===resolvedRef.messageId);
  if(messages.length!==1||messages[0].role!=='assistant'||typeof messages[0].text!=='string'||!messages[0].text.trim())throw Error('Choose exactly one available nonempty assistant reply message.');
  if(createHash('sha256').update(messages[0].text,'utf8').digest('hex')!==resolvedRef.sha256)throw Error('Reply changed since review. Review its current content before selecting or accepting it.');
 }else{
  if(!id(producerTaskId))throw Error('Choose the deliverable producer task explicitly.');
  producerTask(mission,tasks,producerTaskId);
  const artifacts=(mission.artifacts||[]).filter(artifact=>artifact.id===resolvedRef.artifactId);
  if(artifacts.length!==1||!(resolvedRef.kind==='playable'?artifacts[0].kind==='playable':['deliverable','image'].includes(artifacts[0].kind))||artifacts[0].attemptId!==mission.activeAttemptId||artifacts[0].projectId!==mission.projectId)throw Error('Choose a unique attached deliverable from this project and active attempt.');
  if(resolvedRef.kind==='playable'&&(!mission.runId||producerTask(mission,tasks,producerTaskId).runId!==mission.runId||artifacts[0].runId!==mission.runId||artifacts[0].producerTaskId!==producerTaskId||!id(artifacts[0].workspaceId)))throw Error('Playable producer/run/workspace identity changed.');
  const artifact=artifacts[0];if(artifact.sha256!==resolvedRef.sha256)throw Error('Deliverable reference changed since review.');
  return {producerTaskId,ref:resolvedRef,artifact};
 }
 return {producerTaskId,ref:resolvedRef};
}
async function resolveMissionResult(input){
 const result=inspectMissionResult(input);
 if(result.artifact){
  if(typeof input.readArtifact!=='function')throw Error('Fresh guarded artifact reading is required.');
  const observed=await input.readArtifact(result.artifact);
  if(observed?.sha256!==result.ref.sha256)throw Error('Deliverable changed since review. Attach and review its current version.');
  verifyPlayableProof(result,observed,input.mission);
  inspectMissionResult({...input,ref:result.ref,producerTaskId:result.producerTaskId});
 }
 return {producerTaskId:result.producerTaskId,ref:result.ref};
}
function verifyMissionResultCurrent(input){
 const result=inspectMissionResult(input);
 if(result.artifact){const observed=input.readArtifact(result.artifact);if(observed?.sha256!==result.ref.sha256)throw Error('Deliverable changed since review. Attach and review its current version.');verifyPlayableProof(result,observed,input.mission);}
 return {producerTaskId:result.producerTaskId,ref:result.ref};
}
function verifyPlayableProof(result,observed,mission){if(result.ref.kind!=='playable')return;const a=result.artifact;require('./playable-results.cjs').validateManifest(observed?.manifest,{runId:mission.runId,missionId:mission.id,attemptId:mission.activeAttemptId,producerTaskId:result.producerTaskId,workspaceId:a.workspaceId,source:a.source});if(!require('./review-verdicts.cjs').sameSource(observed.source,a.source)||!Array.isArray(observed.artifacts)||observed.artifacts.length!==observed.manifest.artifacts.length||observed.manifest.artifacts.some(h=>!observed.artifacts.some(v=>v.path===h.path&&v.sha256===h.sha256)))throw Error('Playable byte inspection proof missing.');}
module.exports={resolveMissionResult,validateMissionResultRef,verifyMissionResultCurrent};
