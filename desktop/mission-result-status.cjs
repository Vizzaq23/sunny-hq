const {createHash}=require('node:crypto');
const {resolveMissionResult,verifyMissionResultCurrent,validateMissionResultRef}=require('./mission-results.cjs');
const {validateMissionAuthority}=require('./mission-profile.cjs');
const id=value=>typeof value==='string'&&!!value.trim()&&value.length<=200&&!value.includes('\0');
function preview(text){let end=Math.min(2000,text.length);if(end<text.length&&end>0&&/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;return text.slice(0,end);}
function member(state,projectId,taskId){
 if(!id(projectId)||state.projects.filter(project=>project.id===projectId).length!==1)throw Error('Choose a unique registered project.');
 const tasks=state.tasks.filter(task=>task.id===taskId);if(!id(taskId)||tasks.length!==1||tasks[0].projectId!==projectId)throw Error('Choose a unique task in this project.');return tasks[0];
}
function lookup(context,args){
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==3||Object.keys(args).some(key=>!['projectId','missionId','revision'].includes(key))||!id(args.projectId)||!id(args.missionId)||!Number.isSafeInteger(args.revision)||args.revision<0)throw Error('Invalid result status arguments.');
 const state=context.getState();if(state.projects.filter(project=>project.id===args.projectId).length!==1)throw Error('Choose a unique registered project.');
 const matches=state.missions.filter(mission=>mission.id===args.missionId);if(matches.length!==1||matches[0].projectId!==args.projectId)throw Error('Choose a unique mission in this project.');
 const mission=matches[0];if(mission.revision!==args.revision)throw Error('Mission revision changed. Review its current result.');return {state,mission};
}
const binding=mission=>JSON.stringify({id:mission.id,projectId:mission.projectId,revision:mission.revision,status:mission.status,activeAttemptId:mission.activeAttemptId,acceptanceCriteria:mission.acceptanceCriteria,completionBoundary:mission.completionBoundary,selectedResult:mission.selectedResult,acceptance:mission.acceptance,pendingAcceptance:mission.pendingAcceptance,acceptanceRecovery:mission.acceptanceRecovery});
const projectBinding=(state,projectId)=>JSON.stringify(state.projects.filter(project=>project.id===projectId).map(project=>({id:project.id,path:project.path})));
const artifactBinding=artifact=>JSON.stringify(artifact);
// Read-only observation. This cannot accept work or replace the fresh checks in
// select/accept. COMPLETE is examined through a detached review view, never reopened.
async function getMissionResultStatus(context,args){
 const {state,mission}=lookup(context,args),result=mission.selectedResult;
 let ref;try{if(result)ref=validateMissionResultRef(result.ref);}catch{/* Invalid opaque metadata is never a public reference. */}
 const runBinding=JSON.stringify(state.runs?.find(r=>r.id===mission.runId));
 const base={missionId:mission.id,revision:mission.revision,...(ref?.kind==='playable'?{runRevision:state.runs?.find(r=>r.id===mission.runId)?.revision}:{}),...(id(mission.activeAttemptId)?{attemptId:mission.activeAttemptId}:{}),...(result&&id(result.id)?{resultId:result.id}:{}),...(result&&id(result.producerTaskId)?{producerTaskId:result.producerTaskId}:{}),...(ref?{ref}:{})};
 if(mission.pendingAcceptance||mission.acceptanceRecovery)return {...base,available:false,unavailable:'Acceptance needs storage recovery.'};
 if(!result)return {...base,available:false,unavailable:'No result selected. Review an original crew result.'};
 if(!['WAITING_FOR_REVIEW','COMPLETE'].includes(mission.status))return {...base,available:false,unavailable:'Mission is not ready for result review.'};
 const expected=binding(mission),expectedProject=projectBinding(state,args.projectId);let proof;
 try{
  validateMissionAuthority(mission);
  const review={...mission,status:'WAITING_FOR_REVIEW'};
  await resolveMissionResult({mission:review,tasks:state.tasks,ref:result.ref,producerTaskId:result.producerTaskId,readArtifact:typeof context.readArtifact==='function'?async artifact=>{const identity=artifactBinding(artifact),observed=await context.readArtifact(artifact);proof={identity,observed};return observed;}:undefined});
 }catch{return {...base,available:false,unavailable:'Selected result unavailable or changed. Review its current content.'};}
 const current=lookup(context,args);
 if(projectBinding(current.state,args.projectId)!==expectedProject)throw Error('Project root changed during result review.');
 if(binding(current.mission)!==expected)throw Error('Mission result changed during review.');
 try{
  validateMissionAuthority(current.mission);
  if(result.ref.kind==='playable'){
   await resolveMissionResult({mission:{...current.mission,status:'WAITING_FOR_REVIEW'},tasks:current.state.tasks,ref:result.ref,producerTaskId:result.producerTaskId,readArtifact:async artifact=>{if(artifactBinding(artifact)!==proof?.identity)throw Error('Playable binding changed.');const observed=await context.readArtifact(artifact);proof={identity:artifactBinding(artifact),observed};return observed;}});
   const latest=lookup(context,args);if(binding(latest.mission)!==expected||projectBinding(latest.state,args.projectId)!==expectedProject)throw Error('Playable result changed during review.');
   if(JSON.stringify(latest.state.runs?.find(r=>r.id===mission.runId))!==runBinding)throw Error('Playable review authority changed during inspection.');
  }
  verifyMissionResultCurrent({mission:{...current.mission,status:'WAITING_FOR_REVIEW'},tasks:current.state.tasks,ref:result.ref,producerTaskId:result.producerTaskId,readArtifact:artifact=>{if(!proof||artifactBinding(artifact)!==proof.identity)throw Error('Artifact binding changed during review.');return proof.observed;}});
  const task=member(current.state,args.projectId,result.producerTaskId),text=result.ref.kind==='reply'?task.messages.find(message=>message.id===result.ref.messageId).text:undefined;
  let playable;if(result.ref.kind==='playable'){
   const run=current.state.runs?.find(r=>r.id===current.mission.runId),observed=proof.observed;
   if(!run||!observed.summary||!observed.manifest||!observed.source)throw Error('Playable inspection proof missing.');
   const candidate=require('./playable-results.cjs').evaluateCandidate({run,source:observed.source,tasks:current.state.tasks}),final=require('./review-verdicts.cjs').evaluateReadiness({run,...run.verification,source:observed.source,reviews:run.reviews,tasks:current.state.tasks}),missingCheckIds=observed.manifest.requiredCheckIds.filter(id=>!run.verification?.checks.some(c=>c.id===id&&c.status==='passed'&&require('./review-verdicts.cjs').sameSource(c.source,observed.source)));
   if(run.verification?.resultId!==result.id||run.verification?.resultSha256!==result.ref.sha256){candidate.eligible=false;candidate.blockers.push('Verification belongs to another result.');}
   playable={...observed.summary,candidateEligible:candidate.eligible,candidateBlockers:candidate.blockers,ready:final.ready&&candidate.eligible&&!missingCheckIds.length,readinessBlockers:[...final.blockers,...missingCheckIds.map(id=>'Missing manifest check: '+id)],missingCheckIds};
  }
  return {...base,available:true,...(text===undefined?{}:{preview:preview(text)}),...(playable?{playable}:{})};
 }catch{return {...base,available:false,unavailable:'Selected result unavailable or changed. Review its current content.'};}
}
// Called only after main validates sender, page epoch/revision and membership.
// Canonical hashes cover entire main-held messages even for partial page segments.
function attachCanonicalReplyRefs(context,request,page){
 const state=context.getState(),task=member(state,request.projectId,request.taskId);
 if(page.taskId!==task.id)throw Error('Page task does not match the requested task.');
 if(page.stale)return {...page};
 const eligible=task.status==='finished'&&!task.external&&state.missions.some(mission=>mission.projectId===task.projectId&&mission.status==='WAITING_FOR_REVIEW'&&!mission.pendingAcceptance&&!mission.acceptanceRecovery&&mission.taskIds.includes(task.id)&&mission.attempts.some(attempt=>attempt.id===mission.activeAttemptId&&attempt.status==='finished'&&attempt.taskIds.includes(task.id))&&(task.missionId===undefined||task.missionId===mission.id)&&(task.attemptId===undefined||task.attemptId===mission.activeAttemptId));
 const selected=new Map(page.segments.map(segment=>[segment.messageId,{count:0,message:null}]));
 if(eligible)for(const message of task.messages){const entry=selected.get(message.id);if(entry){entry.count++;entry.message=message;}}
 const refs=new Map();for(const [messageId,entry] of selected){const message=entry.message;if(entry.count===1&&message.role==='assistant'&&typeof message.text==='string'&&message.text.trim())refs.set(messageId,{kind:'reply',taskId:task.id,messageId,sha256:createHash('sha256').update(message.text,'utf8').digest('hex')});}
 return {...page,segments:page.segments.map(segment=>{const {replyRef,...display}=segment;return {...display,...(refs.has(segment.messageId)?{replyRef:refs.get(segment.messageId)}:{})};})};
}
module.exports={getMissionResultStatus,attachCanonicalReplyRefs};
