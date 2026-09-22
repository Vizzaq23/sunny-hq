'use strict';
const {createHash}=require('node:crypto');
const {decide}=require('./jev/decide.cjs');
const {ROLE_BINDINGS}=require('./mission-roles.cjs');
const {assertStageAssignment}=require('./mission-workflow.cjs');
const {selectExecution}=require('./model-routing.cjs');
const residents=require('./island-residents.json');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function enabledFor(hub,task,env=process.env){
 return env.SUNNY_JEV_ENABLED==='1'&&typeof env.SUNNY_JEV_PROJECT_IDS==='string'
  &&env.SUNNY_JEV_PROJECT_IDS.split(',').map(s=>s.trim()).includes(task.projectId)
  &&hub.state.projects.some(p=>p.id===task.projectId);
}
function availableRoles(hub,task){
 if(!task.captain)return [];
 const roles=ROLE_BINDINGS.filter(r=>r.crewId!=='luffy').map(r=>({id:r.crewId,description:r.label+': '+r.capability}));
 for(const resident of residents){const current=hub.state.world.residents.find(r=>r.id===resident.id&&r.recruited);if(current)roles.push({id:current.id,description:current.role||resident.role});}
 const attempt=hub.state.missions.flatMap(m=>m.attempts).find(a=>a.taskId===task.id);
 return roles.filter(r=>{try{if(attempt)assertStageAssignment(attempt,hub.state.tasks,r.id);return true;}catch{return false;}});
}
function snapshot(hub,task,prompt){
 const candidates=hub.growth.contextCandidates(task.crewId,prompt,task.projectId);
 return {candidates,roles:availableRoles(hub,task),models:hub.state.models,project:hub.state.projects.find(p=>p.id===task.projectId),
  missions:hub.state.missions.filter(m=>m.attempts.some(a=>a.taskId===task.id)).map(m=>({id:m.id,revision:m.revision})),settingsModel:hub.state.settings.model};
}
async function prepareJevContext({hub,task,prompt,signal,revision,env=process.env,decideImpl=decide}){
 const fallback=(status='fallback',reason='UNAVAILABLE')=>({status,reason,journal:hub.growth.context(task.crewId,prompt,task.projectId),suggestion:'',activity:status==='disabled'?'':'Jev advice unavailable ('+reason+'); using existing context.',revision});
 if(!enabledFor(hub,task,env))return fallback('disabled','DISABLED');
 if(!env.TYPESAFE_API_KEY)return fallback('fallback','MISSING_KEY');
 if(signal?.aborted)return {...fallback('cancelled','CANCELLED'),activity:''};
 const before=snapshot(hub,task,prompt),stamp=digest(before);
 // Do not change legacy handling when pinned content cannot fit its existing budget.
 const pins=before.candidates.filter(c=>c.kind==='note');
 if(pins.some(pin=>!hub.growth.formatContext(pins).includes(JSON.stringify(pin.text))))return fallback('fallback','PINNED_BUDGET');
 const models=task.captain&&!task.explicitExecution&&!hub.state.settings.model?hub.state.models.filter(m=>!m.hidden).map(m=>({id:m.model||m.id,description:m.description||m.displayName||m.model||m.id,efforts:(m.supportedReasoningEfforts||[]).map(e=>e.reasoningEffort)})).filter(m=>m.efforts.length):[];
 const input={schemaVersion:1,objective:prompt,projectId:task.projectId,revision,
  candidates:before.candidates.map(c=>({id:c.id,text:c.text,sourceRevision:digest(c),mandatory:c.kind==='note'})),
  roles:before.roles,models,explicit:{roleId:task.captain?null:task.crewId,modelId:task.explicitExecution?task.model||null:null,effort:task.explicitExecution?task.effort||null:null}};
 let result;try{result=await decideImpl(input,{apiKey:env.TYPESAFE_API_KEY,model:env.JEV_MODEL||'jev-1.13.0',signal});}catch{return fallback('fallback','INVALID_INPUT');}
 if(signal?.aborted||result.status==='cancelled')return {...fallback('cancelled','CANCELLED'),activity:''};
 if(digest(snapshot(hub,task,prompt))!==stamp||!enabledFor(hub,task,env))return fallback('fallback','STALE_CONTEXT');
 if(result.status!=='ok')return fallback('fallback',/^[A-Z0-9_]{1,40}$/.test(result.reason)?result.reason:'UNAVAILABLE');
 const byId=new Map(before.candidates.map(c=>[c.id,c]));
 if(!Array.isArray(result.selectedOptionalIds)||result.selectedOptionalIds.some(id=>!byId.has(id)||byId.get(id).kind==='note'))return fallback('fallback','INVALID_RESPONSE');
 const selected=[...pins,...result.selectedOptionalIds.map(id=>byId.get(id))];
 const advice={};
 if(result.roleSuggestion&&availableRoles(hub,task).some(r=>r.id===result.roleSuggestion))advice.crewId=result.roleSuggestion;
 if(result.modelSuggestion&&!task.explicitExecution&&!hub.state.settings.model){
  try{advice.execution=selectExecution(hub.state.models,{model:result.modelSuggestion.modelId,effort:result.modelSuggestion.effort},hub.state.settings.routingPolicy);}catch{}
 }
 const safeModel=/^jev-[a-zA-Z0-9.-]{1,60}$/.test(result.model)?result.model:'unknown';
 const elapsed=Number.isFinite(result.elapsedMs)?Math.max(0,Math.round(result.elapsedMs)):0;
 return {status:'ok',journal:hub.growth.formatContext(selected),suggestion:Object.keys(advice).length?'Jev advisory recommendation (not an assignment or authorization; explicit user instructions and current mission stage take precedence): '+JSON.stringify(advice):'',activity:'Jev context prepared; advisory only ('+safeModel+', '+elapsed+' ms).',revision};
}
module.exports={prepareJevContext,enabledFor,availableRoles};

