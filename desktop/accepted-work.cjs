const {createHash}=require('node:crypto');
const {validateMissionAuthority}=require('./mission-profile.cjs');
const {getMissionResultStatus}=require('./mission-result-status.cjs');
const id=value=>typeof value==='string'&&value.trim().length>0&&value.length<=200&&!value.includes('\0');
const list=value=>Array.isArray(value)?value:[];
const SCAN_LIMIT=10000,PAGE_SIZE=50;
function argumentsFor(args,fields){if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==fields.length||Object.keys(args).some(k=>!fields.includes(k)))throw Error('Invalid accepted-work query.');}
function project(state,projectId){if(state.persistence?.uncertain||['unsaved','uncertain'].includes(state.persistence?.state))throw Error('Storage outcome unresolved. Recover saved work before opening the shelf.');const matches=list(state.projects).filter(p=>p.id===projectId);if(!id(projectId)||matches.length!==1)throw Error('Choose a registered shelf project.');return matches[0];}
function accepted(mission){
 if(mission?.status!=='COMPLETE'||mission.pendingAcceptance||mission.acceptance?.legacy||mission.acceptance?.actor!=='captain')return false;
 try{validateMissionAuthority(mission);return Boolean(mission.selectedResult&&mission.acceptance?.id);}catch{return false;}
}
function entry(mission){
 const a=mission.acceptance,result=mission.selectedResult;
 const decisions=list(mission.reviewDecisions).filter(d=>d.actor==='captain'&&d.decision==='accepted'&&d.attemptId===a.attemptId&&d.reviewedRevision===a.reviewedRevision&&d.time===a.acceptedAt);
 return {projectId:mission.projectId,missionId:mission.id,title:String(mission.title??'Accepted work').slice(0,200),revision:mission.revision,attemptId:a.attemptId,acceptanceId:a.id,acceptedAt:a.acceptedAt,resultId:a.resultId,resultSha256:a.resultSha256,kind:result.ref.kind,decisionId:decisions.length===1?decisions[0].id:null,recovery:Boolean(mission.acceptanceRecovery)};
}
function query(state,args){
 argumentsFor(args,['projectId','query','offset']);project(state,args.projectId);
 if(typeof args.query!=='string'||args.query.length>200||args.query.includes('\0')||!Number.isSafeInteger(args.offset)||args.offset<0||args.offset>SCAN_LIMIT)throw Error('Invalid shelf search or page.');
 const missions=list(state.missions),counts=new Map(),missionCounts=new Map();
 if(missions.length>SCAN_LIMIT)return {projectId:args.projectId,entries:[],total:0,nextOffset:null,excluded:0,limited:true,scanned:0};
 for(const m of missions){if(m.acceptance?.id)counts.set(m.acceptance.id,(counts.get(m.acceptance.id)||0)+1);missionCounts.set(m.id,(missionCounts.get(m.id)||0)+1);}
 const needle=args.query.trim().toLocaleLowerCase(),matches=[];let excluded=0;
 for(const m of missions.slice(0,SCAN_LIMIT)){
  if(m.projectId!==args.projectId||m.status!=='COMPLETE')continue;
  if(!accepted(m)||counts.get(m.acceptance.id)!==1||missionCounts.get(m.id)!==1){excluded++;continue;}
  const item=entry(m);if([item.title,item.resultId,item.acceptanceId,item.kind].join(' ').toLocaleLowerCase().includes(needle))matches.push(item);
 }
 matches.sort((a,b)=>b.acceptedAt-a.acceptedAt||a.acceptanceId.localeCompare(b.acceptanceId));
 return {projectId:args.projectId,entries:matches.slice(args.offset,args.offset+PAGE_SIZE),total:matches.length,nextOffset:args.offset+PAGE_SIZE<matches.length?args.offset+PAGE_SIZE:null,excluded,limited:missions.length>SCAN_LIMIT,scanned:Math.min(missions.length,SCAN_LIMIT)};
}
function selected(state,args){
 argumentsFor(args,['projectId','missionId','revision','acceptanceId','resultId','resultSha256']);project(state,args.projectId);
 if(!['missionId','acceptanceId','resultId'].every(k=>id(args[k]))||!Number.isSafeInteger(args.revision)||args.revision<0||typeof args.resultSha256!=='string'||!/^[a-f0-9]{64}$/.test(args.resultSha256))throw Error('Invalid accepted result identity.');
 const matches=list(state.missions).filter(m=>m.id===args.missionId),mission=matches[0];
 if(matches.length!==1||mission.projectId!==args.projectId||!accepted(mission)||mission.revision!==args.revision||mission.acceptance.id!==args.acceptanceId||mission.acceptance.resultId!==args.resultId||mission.acceptance.resultSha256!==args.resultSha256||state.missions.filter(m=>m.acceptance?.id===args.acceptanceId).length!==1)throw Error('Accepted result changed. Refresh the shelf.');
 return mission;
}
async function preview(context,args){
 const state=context.getState(),mission=selected(state,args),identity=JSON.stringify(entry(mission));
 const base={...entry(mission),status:'unavailable',preview:null,sourceCommit:null};
 if(mission.acceptanceRecovery)return {...base,reason:'Acceptance needs storage recovery.'};
 let observed,changed=false;
 const ref=mission.selectedResult.ref;
 if(ref.kind==='reply'){
  const tasks=list(state.tasks).filter(t=>t.id===ref.taskId&&t.projectId===args.projectId),messages=tasks.length===1?list(tasks[0].messages).filter(m=>m.id===ref.messageId&&m.role==='assistant'):[];
  if(messages.length===1&&typeof messages[0].text==='string')changed=createHash('sha256').update(messages[0].text).digest('hex')!==args.resultSha256;
 }
 const status=await getMissionResultStatus({...context,readArtifact:async artifact=>{observed=await context.readArtifact(artifact);changed=observed.sha256!==args.resultSha256;return observed;}},{projectId:args.projectId,missionId:args.missionId,revision:args.revision});
 const current=selected(context.getState(),args);if(JSON.stringify(entry(current))!==identity)throw Error('Accepted review changed during inspection. Refresh the shelf.');
 if(!status.available)return {...base,status:changed?'changed':'unavailable',reason:changed?'Changed since acceptance':'Accepted content unavailable or unverified.'};
 const run=list(context.getState().runs).find(r=>r.id===current.runId&&r.projectId===args.projectId&&list(r.missionIds).includes(current.id));
 const source=run?.verification?.resultId===args.resultId&&run.verification.resultSha256===args.resultSha256?run.verification.source?.headCommit:null;
 return {...base,status:'verified',preview:status.preview??(ref.kind==='deliverable'&&typeof observed?.text==='string'?observed.text.slice(0,2000):null),sourceCommit:typeof source==='string'?source.slice(0,200):null,reason:ref.kind==='reply'||ref.kind==='deliverable'?'Preview matches the accepted SHA-256.':'Accepted bytes verified. This shelf does not execute or embed this result.'};
}
module.exports={query,preview,selected};
