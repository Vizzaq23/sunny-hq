const {createStateProjection}=require('./state-projection.cjs');
const {getMissionResultStatus,attachCanonicalReplyRefs}=require('./mission-result-status.cjs');

// One producer belongs to one Hub lifetime. Window-specific reads share its epoch
// and current sequence, but never consume a broadcast sequence number.
function createPublicTransport(hub,options={}){
 const producer=createStateProjection(options);
 let bound=false;
 for(const task of hub.state.tasks)producer.summary(task);
 const context={getState:()=>hub.state,readArtifact:options.readArtifact||((artifact)=>hub.readMissionResultArtifact(hub.project(artifact.projectId),artifact))};
 function member(projectId,taskId){
  if(hub.state.projects.filter(project=>project.id===projectId).length!==1)throw Error('Choose a unique registered project.');
  const matches=hub.state.tasks.filter(task=>task.id===taskId);
  if(matches.length!==1||matches[0].projectId!==projectId)throw Error('Choose a unique task in this project.');return matches[0];
 }
 function snapshot(){return producer.snapshot(hub.state);}
 function taskReply(task){if(task===undefined||task===null)return task;return producer.summary(member(task.projectId,task.id));}
 function runReply(run){if(!run||hub.state.projects.filter(project=>project.id===run.projectId).length!==1)throw Error('Choose a unique registered run project.');const current=hub.state.runs?.find(value=>value.id===run.id);if(!current||current.projectId!==run.projectId||current.revision!==run.revision)throw Error('Run changed before public reply. Inspect its current revision.');return producer.snapshot({runs:[current],tasks:[]}).runs[0];}
 function event(type,data){
  if(type==='snapshot')return producer.event(type,hub.state);
  if(type==='task')return producer.event(type,member(data.projectId,data.id));
  // Approval IDs from the provider are privileged transport correlation keys.
  if(type==='approval')data=producer.snapshot({approvals:[data],tasks:[]}).approvals[0];
  if(type==='persistence')data=producer.snapshot({persistence:data,tasks:[]}).persistence;
  return producer.event(type,data);
 }
 function transcriptChanged(task,change){
  if(member(task.projectId,task.id)!==task)throw Error('Detached task cannot publish an authoritative transcript mutation.');
  const delta=producer.transcriptChanged(task,change);
  return {type:'transcript:delta',epoch:delta.epoch,sequence:delta.sequence,data:delta};
 }
 function page(request){
  if(request&&typeof request==='object')member(request.projectId,request.taskId);
  return attachCanonicalReplyRefs(context,request,producer.page(hub.state,request));
 }
 async function resultStatus(request){
  const status=await getMissionResultStatus(context,request);
  return {epoch:producer.epoch,...status,...(hub.state.persistence?.uncertain||hub.state.persistence?.state==='uncertain'?{available:false,unavailable:'Storage outcome uncertain. Export drafts and recover storage before accepting work.'}:{})};
 }
 function bindTranscript(send){
  if(typeof send!=='function')throw Error('Transcript delivery callback is required.');
  if(bound)throw Error('Transcript producer is already bound.');bound=true;
  const seed=task=>producer.summary(member(task.projectId,task.id));
  const mutation=(task,change)=>send(transcriptChanged(task,change));
  hub.on('transcript:seed',seed);hub.on('transcript:mutation',mutation);
  let disposed=false;
  return ()=>{if(disposed)return;disposed=true;hub.off('transcript:seed',seed);hub.off('transcript:mutation',mutation);bound=false;};
 }
 return {producer,snapshot,taskReply,runReply,event,transcriptChanged,page,resultStatus,bindTranscript};
}
module.exports={createPublicTransport};
