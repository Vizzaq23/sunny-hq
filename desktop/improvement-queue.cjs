const {createHash}=require('node:crypto');
const registry=require('./crew-registry.cjs');
const kinds=['completed_result','user_feedback','new_verified_evidence'];
const text=v=>typeof v==='string'&&v.trim()&&v.length<=200&&!v.includes('\0');
function standing(run){return Boolean(run.originalScope?.standingImprovement&&run.originalScope.standingImprovement===run.grant.scope.standingImprovement&&run.originalScope.activities.includes('read')&&run.grant.scope.activities.includes('read'));}
function allowance(run,{reserved=false}={}){const c=run.counters,g=run.grant;return standing(run)&&c.improvementMs<g.improvementMs&&c.improvementTokens<g.improvementTokens&&c.activeMs<g.activeMs&&c.tokens<g.tokenLimit&&(reserved?c.launches<=g.maxLaunches:c.launches<g.maxLaunches);}
function queueImprovement(run,input){
 if(!input||Object.keys(input).some(k=>!['triggerId','kind','evidenceRef'].includes(k))||!text(input.triggerId)||!kinds.includes(input.kind))throw Error('Invalid improvement event');
 const e=input.evidenceRef;if(!e||Object.keys(e).some(k=>!['sourceId','revision','baseCommit','time'].includes(k))||!['sourceId','revision','baseCommit'].every(k=>text(e[k]))||!Number.isSafeInteger(e.time)||e.time<0)throw Error('Invalid improvement evidence');
 const next=structuredClone(run),id='improve-'+createHash('sha256').update(JSON.stringify([input.kind,e.sourceId,e.revision])).digest('hex');
 if(next.improvementTriggers.some(t=>t.id===id))return next;
 if(next.improvementTriggers.length>=256)throw Error('Improvement receipt capacity reached');
 const state=standing(next)?'queued':'backlog';next.improvementTriggers.push({id,kind:input.kind,sourceId:e.sourceId,time:e.time,revision:e.revision,baseCommit:e.baseCommit,evidenceRef:input.triggerId,state,...(state==='backlog'?{proposal:{rank:next.improvementTriggers.filter(t=>t.state==='backlog').length+1,benefit:'Assess local quality after new evidence',evidenceRef:input.triggerId,estimatedCost:{activeMs:300000,tokens:10000}}}:{})});return next;
}
function nextImprovement(run){
 if(!['waiting','executing','repairing'].includes(run.phase)||run.stopIntent||run.controlIntent?.state==='pending'||run.coordinatorContinuation||run.blockers?.length||!standing(run)||!allowance(run)||run.assignments.length>=32||run.assignments.some(a=>a.state==='queued'||['reserved','starting','working','waiting','unknown'].includes(a.state)))return null;
 const trigger=run.improvementTriggers.find(t=>t.state==='queued'&&t.revision);if(!trigger)return null;
 return {id:trigger.id,crewId:'nami',roleId:'planner',capability:'planning',objective:'Read-only assessment within captain standing scope: '+run.grant.scope.standingImprovement.slice(0,10000)+'. Return ranked proposals with benefit, evidence and estimated cost. Do not edit files, accept results or launch work. Evidence receipt: '+trigger.evidenceRef,ownedPaths:[],dependencies:[],criteriaIds:(run.criteria||[]).map(c=>c.id),baseCommit:trigger.baseCommit,state:'queued',queueBinding:registry.crewBinding('nami'),improvementTriggerId:trigger.id};
}
function validateReceipts(run,{fields,check,records,string,time}){
 records(run.improvementTriggers,256,v=>{fields(v,['id','kind','sourceId','time'],['revision','baseCommit','evidenceRef','state','assignmentId','proposal']);check(kinds.includes(v.kind)&&string(v.sourceId)&&time(v.time));if(v.revision!==undefined){check(['revision','baseCommit','evidenceRef'].every(k=>string(v[k]))&&['queued','backlog','consumed'].includes(v.state));check(v.assignmentId===undefined||run.assignments.some(a=>a.id===v.assignmentId&&a.improvementTriggerId===v.id));if(v.state==='consumed')check(v.assignmentId!==undefined);if(v.proposal!==undefined){fields(v.proposal,['rank','benefit','evidenceRef','estimatedCost']);check(Number.isSafeInteger(v.proposal.rank)&&v.proposal.rank>0&&v.proposal.rank<=256&&string(v.proposal.benefit,2000)&&string(v.proposal.evidenceRef));fields(v.proposal.estimatedCost,['activeMs','tokens']);check(v.proposal.estimatedCost.activeMs===300000&&v.proposal.estimatedCost.tokens===10000);}}else check(['baseCommit','evidenceRef','state','assignmentId','proposal'].every(k=>v[k]===undefined));});
 if(run.improvementUsage!==undefined)records(run.improvementUsage,256,v=>{fields(v,['id','provider','threadId','assignmentId']);check(string(v.provider)&&string(v.threadId)&&run.assignments.some(a=>a.id===v.assignmentId&&a.improvementTriggerId));});
 for(const a of run.assignments)if(a.improvementTriggerId)check(a.crewId==='nami'&&a.roleId==='planner'&&a.capability==='planning'&&a.ownedPaths.length===0&&run.improvementTriggers.some(t=>t.id===a.improvementTriggerId&&t.assignmentId===a.id));
}
function assessmentFor(hub,task){return hub.state.runs.find(r=>r.id===task.runId)?.assignments.find(a=>a.id===task.assignmentId&&a.taskId===task.id&&a.improvementTriggerId);}
async function assessmentOptions(hub,project,task){if(!assessmentFor(hub,task))return {};const effective=await hub.client.request('config/read',{cwd:project.path,includeLayers:false});return {sandbox:'read-only',approvalPolicy:'never',config:require('./crew-chat.cjs').discussionConfig(effective.config||{}),dynamicTools:[]};}
module.exports={queueImprovement,nextImprovement,validateReceipts,allowance,assessmentFor,assessmentOptions};
