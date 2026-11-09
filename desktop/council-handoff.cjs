const {randomUUID,createHash}=require('node:crypto');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
function brief(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['title','objective','acceptanceCriteria','completionBoundary'].includes(k)))throw Error('Invalid reviewed handoff brief.');
 for(const [key,max]of [['title',120],['objective',12000]])if(typeof value[key]!=='string'||!value[key].trim()||value[key].length>max||value[key].includes('\0'))throw Error('Invalid reviewed handoff brief.');
 if(value.completionBoundary!=='review'||!Array.isArray(value.acceptanceCriteria)||!value.acceptanceCriteria.length||value.acceptanceCriteria.length>10||Array.from(value.acceptanceCriteria).some(v=>typeof v!=='string'||!v.trim()||v.length>1000||v.includes('\0')))throw Error('Invalid reviewed handoff brief.');
 return {title:value.title,objective:value.objective,acceptanceCriteria:[...value.acceptanceCriteria],completionBoundary:'review'};
}
const digest=value=>createHash('sha256').update(JSON.stringify(brief(value))).digest('hex');
function create(value){const reviewedBrief=brief(value);return {version:2,status:'pending',missionId:randomUUID(),runId:randomUUID(),taskId:'',error:'',reviewedBrief,briefSha256:digest(reviewedBrief),time:Date.now()};}
function restore(value){
 if(value.version===undefined)return {};
 try{if(value.version!==2||!uuid(value.missionId)||!uuid(value.runId)||value.missionId===value.runId)throw Error();const reviewedBrief=brief(value.reviewedBrief);if(digest(reviewedBrief)!==value.briefSha256)throw Error();return {version:2,reviewedBrief,briefSha256:value.briefSha256};}
 catch{return {version:2,status:'unknown',error:'Saved handoff binding is invalid. Preserve the record and inspect tracked work; do not retry.'};}
}
function binding(hub,input,options){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).length!==1||typeof options.councilId!=='string')throw Error('Invalid internal council handoff.');
 const record=hub.localCouncil.record(options.councilId),handoff=record?.handoff;
 if(!handoff||handoff.version!==2||handoff.status!=='pending'||record.projectId!==input.projectId||restore(handoff).status==='unknown'||handoff.briefSha256!==digest({title:input.title,objective:input.objective,acceptanceCriteria:input.acceptanceCriteria,completionBoundary:input.completionBoundary})||input.result!==undefined)throw Error('Reviewed council handoff changed.');
 if(hub.state.missions.some(m=>m.id===handoff.missionId)||hub.state.runs.some(r=>r.id===handoff.runId))throw Error('Reserved council work already exists. Inspect its outcome; do not retry.');
 return {missionId:handoff.missionId,runId:handoff.runId};
}
module.exports={create,restore,binding,uuid};
