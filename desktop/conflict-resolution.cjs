// Private, additive resolution-v1 receipts. Predicates do not grant OS authority.
const {sameSource}=require('./review-verdicts.cjs');
const {fields,id}=require('./integration-schema.cjs');
const oid=v=>typeof v==='string'&&/^[a-f0-9]{40,64}$/.test(v);
const fail=()=>{throw Error('Invalid conflict resolution authority; preserve profile and bundle');};
const check=v=>{if(!v)fail();};
const bounded=(a,n,p)=>check(Array.isArray(a)&&a.length<=n&&Array.from({length:a.length},(_,i)=>i).every(i=>Object.hasOwn(a,i)&&p(a[i])));
function binding(run,assignment){
 const r=run?.integrations?.find(r=>r.resolution?.assignmentId===assignment?.id),v=r?.resolution,t=assignment?.resolutionOwnership;
 return r?.state==='conflict'&&v?.version===1&&v.operationId===r.id&&v.runId===run.id&&v.projectId===run.projectId&&v.ordinal>0&&v.ordinal<=run.counters.repairs&&v.ordinal<=Math.min(3,run.grant.maxRepairs)&&assignment.baseCommit===r.before.headCommit&&assignment.dependencies.includes(r.assignmentId)&&(!t||t.operationId===r.id&&t.fromAssignmentId===r.assignmentId&&t.fromWorkspaceId===r.workspaceId&&t.bundleSha256===v.bundle?.sha256&&sameSource(t.source,run.assignments.find(a=>a.id===r.assignmentId)?.sourceResult))?r:null;
}
function contribution(run,r){
 if(r.state==='completed')return {before:r.before,after:r.after,commits:r.resultingCommits,assignments:[r.assignmentId]};
 const v=r.resolution,a=run.assignments.find(a=>a.id===v?.assignmentId);
 if(v?.state==='completed'){try{validate(run,r);}catch{return null;}}
 if(v?.state!=='completed'||!binding(run,a)||!a.resolutionOwnership||a.state!=='finished'||a.sourceResult?.headCommit!==v.candidate?.workerHead||a.sourceResult.fingerprint!==v.candidate.workerFingerprint||a.taskId!==v.author?.taskId||!run.authorHistory?.some(s=>s.taskId===a.taskId&&s.threadId===v.author.threadId&&s.state==='ready'))return null;
 return {before:r.before,after:v.finalSource,commits:v.resultingCommits,assignments:[r.assignmentId,a.id]};
}
const unresolved=(run,r)=>!contribution(run,r);
function pending(run){return run?.integrations?.filter(r=>r.state==='conflict'&&!contribution(run,r))||[];}
function entitled(run){return !run?.stopIntent&&!['paused','stopping','stopped','unknown'].includes(run?.phase)&&run?.controlIntent?.state!=='pending'&&!run?.coordinatorContinuation&&pending(run).some(r=>['reserved','preparation-intent','prepared','applying'].includes(r.resolution?.state)&&binding(run,run.assignments.find(a=>a.id===r.resolution.assignmentId)));}
function completed(run){const records=run?.integrations||[];return records.at(-1)?.resolution?.state==='completed'&&records.every(r=>contribution(run,r));}
function assignmentAllowed(run,a){
 const p=pending(run);if(p.length)return p.length===1&&binding(run,a)===p[0]&&p[0].resolution.state==='prepared'&&!!a.resolutionOwnership;
 return !require('./repair-policy.cjs').repairExhausted(run)||completed(run)&&require('./crew-registry.cjs').reviewAssignment(a)&&run.verification?.integrationVerified&&a.baseCommit===run.verification.source.headCommit;
}
function budgetAllowance(run,{assignmentId,purpose}={}){
 if(assignmentId)return (pending(run).length>0||completed(run))&&assignmentAllowed(run,run.assignments.find(a=>a.id===assignmentId));
 if(purpose==='accounting')return entitled(run)||completed(run);
 if(purpose==='resolution')return entitled(run);
 return purpose==='verification'&&completed(run);
}
function transferred(run,owner){return run.assignments.some(a=>a.resolutionOwnership?.fromAssignmentId===owner.id&&binding(run,a));}
function summary(run){const held=pending(run);if(held.length===1&&held[0].resolution?.state==='prepared'&&binding(run,run.assignments.find(a=>a.id===held[0].resolution.assignmentId)))return {assignmentId:held[0].resolution.assignmentId,state:'prepared'};if(completed(run)){const op=run.integrations.findLast(r=>r.resolution?.state==='completed'&&contribution(run,r));return {assignmentId:op.resolution.assignmentId,state:'completed'};}return undefined;}
function validate(run,r){
 const v=r.resolution;if(v===undefined)return;
 fields(v,['version','id','runId','projectId','operationId','ordinal','assignmentId','before','state'],['prepareRevision','settleRevision','bundle','workspaceId','candidate','author','abortSource','abortResult','resultingCommits','finalSource','error']);
 const a=run.assignments.find(a=>a.id===v.assignmentId),owner=run.assignments.find(a=>a.id===r.assignmentId);
 check(r.state==='conflict'&&v.version===1&&id(v.id)&&v.runId===run.id&&v.projectId===run.projectId&&v.operationId===r.id&&Number.isSafeInteger(v.ordinal)&&v.ordinal>0&&v.ordinal<=run.counters.repairs&&v.ordinal<=3&&sameSource(v.before,r.before)&&a&&owner&&a.id==='resolution-'+r.id&&a.crewId===owner.crewId&&a.roleId===owner.roleId&&a.capability===owner.capability&&sameSource(a.ownedPaths,owner.ownedPaths)&&sameSource(a.criteriaIds,owner.criteriaIds)&&a.dependencies.length===1&&a.dependencies[0]===owner.id&&a.baseCommit===r.before.headCommit&&['reserved','preparation-intent','prepared','applying','completed','unknown'].includes(v.state));
 require('./supervision-schema.cjs').validateSource(v.before);
 for(const key of ['prepareRevision','settleRevision'])if(v[key]!==undefined)check(Number.isSafeInteger(v[key])&&v[key]>=0&&v[key]<=run.revision);
 if(['preparation-intent','prepared','applying','completed'].includes(v.state))check(v.prepareRevision!==undefined);
 if(['applying','completed'].includes(v.state))check(v.settleRevision!==undefined);
 if(v.state==='reserved')check(Object.keys(v).every(k=>['version','id','runId','projectId','operationId','ordinal','assignmentId','before','state'].includes(k)));
 if(['preparation-intent','prepared'].includes(v.state))check(['settleRevision','candidate','author','abortSource','abortResult','resultingCommits','finalSource','error'].every(k=>v[k]===undefined));
 if(v.state==='applying')check(v.finalSource===undefined&&v.resultingCommits===undefined&&v.error===undefined);
 if(v.state==='completed')check(v.error===undefined);
 if(v.bundle){fields(v.bundle,['id','sha256','bytes']);check(v.bundle.id===v.id&&/^[a-f0-9]{64}$/.test(v.bundle.sha256)&&Number.isSafeInteger(v.bundle.bytes)&&v.bundle.bytes>0&&v.bundle.bytes<=16*1024*1024);}
 if(v.workspaceId!==undefined)check(id(v.workspaceId)&&a.workspaceId===v.workspaceId&&run.workspaces.some(w=>w.id===v.workspaceId&&w.assignmentId===a.id&&w.baseCommit===a.baseCommit));
 if(['prepared','applying','completed'].includes(v.state))check(v.bundle&&v.workspaceId&&a.resolutionOwnership);
 if(v.candidate){const c=v.candidate;fields(c,['assignmentId','workspaceId','workerBase','workerHead','workerFingerprint','commits','changedPaths']);check(c.assignmentId===a.id&&c.workspaceId===v.workspaceId&&c.workerBase===a.baseCommit&&oid(c.workerHead)&&id(c.workerFingerprint)&&a.state==='finished'&&a.sourceResult?.headCommit===c.workerHead&&a.sourceResult.fingerprint===c.workerFingerprint);bounded(c.commits,256,oid);check(c.commits.length&&c.commits.at(-1)===c.workerHead&&new Set(c.commits).size===c.commits.length);bounded(c.changedPaths,5000,p=>typeof p==='string'&&p.length<=4096);check(new Set(c.changedPaths).size===c.changedPaths.length);}
 if(v.author){fields(v.author,['taskId','threadId','turnId']);check(Object.values(v.author).every(id)&&v.author.taskId===a.taskId&&run.authorHistory?.some(s=>s.taskId===a.taskId&&s.threadId===v.author.threadId&&s.state==='ready'));}
 if(['applying','completed'].includes(v.state))check(v.candidate&&v.author);
 if(v.abortSource)require('./supervision-schema.cjs').validateSource(v.abortSource);
 if(v.abortResult){fields(v.abortResult,['code','observedExit']);check(v.abortResult.code===0&&v.abortResult.observedExit===true);}
 check(Boolean(v.abortResult)===Boolean(v.abortSource));
 if(v.finalSource)require('./supervision-schema.cjs').validateSource(v.finalSource);
 if(v.resultingCommits)bounded(v.resultingCommits,256,oid);
 if(v.state==='completed')check(r.command?.id===r.id&&r.command.state==='completed'&&v.abortResult&&sameSource(v.abortSource,r.before)&&v.finalSource&&v.resultingCommits?.length===v.candidate.commits.length&&new Set(v.resultingCommits).size===v.resultingCommits.length&&v.resultingCommits.at(-1)===v.finalSource.headCommit&&v.finalSource.baseCommit===r.before.baseCommit);
 if(v.error!==undefined)check(typeof v.error==='string'&&v.error.length<=4096);
 if(a.resolutionOwnership){const t=a.resolutionOwnership;fields(t,['operationId','fromAssignmentId','fromWorkspaceId','source','bundleSha256']);require('./supervision-schema.cjs').validateSource(t.source);check(t.operationId===r.id&&t.fromAssignmentId===owner.id&&t.fromWorkspaceId===owner.workspaceId&&sameSource(t.source,owner.sourceResult)&&t.bundleSha256===v.bundle?.sha256);}
}
module.exports={binding,contribution,unresolved,pending,entitled,completed,assignmentAllowed,budgetAllowance,transferred,summary,validate};
