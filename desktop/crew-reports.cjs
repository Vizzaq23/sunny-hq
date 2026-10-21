// Pure allowlist: no provider, runtime tools, transcripts or command output.
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,200}$/.test(value)?value:'unavailable';
function buildCrewReport({run,missions=[],now}){
 if(!run||!Number.isSafeInteger(now)||now<0)throw Error('Invalid report source/time');
 const packet={version:1,runId:identifier(run.id),projectId:identifier(run.projectId),revision:Number.isSafeInteger(run.revision)?run.revision:0,time:now,confirmedEvidence:[],attributedClaims:[],failedChecks:[],unavailableServices:[]};
 const entry=(id,description,source,time)=>({id:identifier(id),description,source:identifier(source),time:Number.isSafeInteger(time)&&time>=0?time:null});
 for(const c of (run.verification?.checks||[]).slice(0,256)){const receipt=(run.combinedChecks||[]).find(check=>check.state==='completed'&&(c.id===check.id||c.id.startsWith(check.id+':'))&&check.source?.headCommit===c.source?.headCommit&&check.source?.fingerprint===c.source?.fingerprint);const item=entry(c.id,c.status==='passed'?'Main verification check passed':'Main verification check failed',c.source?.headCommit,c.time??receipt?.time);if(c.status==='passed')packet.confirmedEvidence.push(item);else if(c.status==='failed')packet.failedChecks.push(item);}
 for(const m of missions.filter(m=>m.runId===run.id&&m.projectId===run.projectId).slice(0,256))if(m.acceptance&&!m.acceptance.legacy)packet.confirmedEvidence.push(entry(m.acceptance.id,'Captain acceptance receipt','acceptance:'+identifier(m.acceptance.id),m.acceptance.acceptedAt));
 for(const r of (run.reviews||[]).slice(0,256))packet.attributedClaims.push(entry(r.id,['approve','request_changes','blocked'].includes(r.decision)?'Reviewer verdict: '+r.decision:'Reviewer verdict unavailable',r.source?.headCommit,r.time));
 if(run.phase==='unknown')packet.unavailableServices.push(entry('run-recovery','Run service unavailable pending explicit reconciliation','run:'+identifier(run.id),now));
 return packet;
}
module.exports={buildCrewReport};
