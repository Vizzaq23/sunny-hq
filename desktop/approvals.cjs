const {randomUUID}=require('node:crypto');
const ACTIVE=new Set(['starting','working','waiting']);
const LIFETIME=30*60*1000;

function freeze(value){
 if(value&&typeof value==='object'){
  for(const item of Object.values(value))freeze(item);
  Object.freeze(value);
 }
 return value;
}
function object(value,label){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Invalid '+label+'.');
 return value;
}
function createApproval(request,task,now=Date.now()){
 if(!task||!ACTIVE.has(task.status)||task.external)throw Error('Approval has no active Sunny task.');
 const params=object(request.params,'approval parameters');
 if(typeof params.threadId!=='string'||!params.threadId.trim()||params.threadId.length>200||typeof task.threadId!=='string'||!task.threadId.trim()||task.threadId.length>200)throw Error('Approval requires a valid thread identifier.');
 const nullable=request.method==='mcpServer/elicitation/request'&&params.turnId==null;
 if(!nullable&&(typeof params.turnId!=='string'||!params.turnId.trim()||params.turnId.length>200))throw Error('Approval requires a valid turn identifier.');
 if(params.threadId!==task.threadId||(params.turnId&&task.turnId&&params.turnId!==task.turnId))throw Error('Approval belongs to a stale turn.');
 if(!['string','number'].includes(typeof request.id))throw Error('Invalid approval request ID.');
 task.executionId??=randomUUID();
 return freeze({id:randomUUID(),rpcId:request.id,method:request.method,params:structuredClone(params),taskId:task.id,projectId:task.projectId,threadId:task.threadId,executionId:task.executionId,turnId:nullable?null:params.turnId,createdAt:now,expiresAt:now+LIFETIME});
}
function approvalResult(approval,input,task,now=Date.now()){
 object(input,'approval response');
 if(Object.keys(input).some(key=>!['id','decision','answers'].includes(key)))throw Error('Unknown approval response field.');
 const {decision,answers}=input;
 if(!['accept','decline'].includes(decision))throw Error('Choose allow or decline.');
 if(!task||!ACTIVE.has(task.status)||task.id!==approval.taskId||task.projectId!==approval.projectId||task.threadId!==approval.threadId||task.executionId!==approval.executionId||(approval.turnId!==null&&task.turnId!==approval.turnId))throw Error('This approval is no longer valid for the current task or turn.');
 if(decision==='accept'&&now>=approval.expiresAt)throw Error('This approval expired. Decline it and ask the crew to request the action again.');
 if(answers!==undefined){object(answers,'answers');if(JSON.stringify(answers).length>100000)throw Error('Answers are too long.');}
 if(approval.method==='item/tool/requestUserInput'){
  if(decision==='decline')return {answers:{}};
  const questions=new Set((approval.params.questions||[]).map(q=>q.id));
  const entries=Object.entries(answers||{}).map(([key,value])=>{
   if(!questions.has(key))throw Error('Unknown approval question.');
   const values=typeof value==='string'?[value]:value?.answers;
   if(!Array.isArray(values)||values.length>50||values.some(v=>typeof v!=='string'||v.length>10000))throw Error('Invalid question answer.');
   return [key,{answers:values}];
  });
  return {answers:Object.fromEntries(entries)};
 }
 if(approval.method==='item/permissions/requestApproval')return {permissions:decision==='accept'?approval.params.permissions||{}:{},scope:'turn'};
 if(approval.method==='mcpServer/elicitation/request')return {action:decision,content:decision==='accept'?answers||{}:null};
 return {decision};
}
module.exports={createApproval,approvalResult};
