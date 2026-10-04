const {ROLE_BINDINGS}=require('./mission-roles.cjs');
const STAGES=[{id:'plan',roles:['planner']},{id:'work',roles:['builder','designer','researcher','diagnostician','creator','operator']},{id:'validate',roles:['validator']},{id:'review',roles:['reviewer']}];
const roleFor=crewId=>ROLE_BINDINGS.find(r=>r.crewId===crewId)?.id;
function stageProgress(attempt,tasks){
 const children=tasks.filter(t=>t.parentTaskId===attempt.taskId);
 if(attempt.taskIds)children.sort((a,b)=>attempt.taskIds.indexOf(a.id)-attempt.taskIds.indexOf(b.id));
 let cursor=0,blocked=false;
 const stages=STAGES.map(stage=>{
  if(blocked)return {id:stage.id,status:'pending'};
  const index=children.findIndex((t,i)=>i>=cursor&&stage.roles.includes(roleFor(t.crewId)));
  const task=index<0?null:children[index];
  if(!task){blocked=true;return {id:stage.id,status:'pending'};}
  const output=task.messages?.findLast(m=>m.role==='assistant'&&typeof m.text==='string'&&m.text.trim());
  const done=task.status==='finished'&&Boolean(output);cursor=index+1;blocked=!done;
  return {id:stage.id,taskId:task.id,status:done?'complete':task.status==='finished'?'result-missing':task.status,resultMessageId:done?output.id:undefined};
 });
 return {stages,complete:stages.every(s=>s.status==='complete')};
}
function assertStageAssignment(attempt,tasks,crewId){
 if(attempt.workflowVersion!==1)return;
 const progress=stageProgress(attempt,tasks),next=progress.stages.find(s=>s.status!=='complete');
 if(!next)throw Error('All coordinated stages are finished. Summarize the result; additional work needs a new attempt.');
 const stage=STAGES.find(s=>s.id===next.id);
 if(!stage.roles.includes(roleFor(crewId)))throw Error(`Complete the ${stage.id} stage next using ${stage.roles.join(' or ')}. Each preceding stage needs a finished task with an actual result.`);
}
module.exports={stageProgress,assertStageAssignment,evaluateReadiness:require('./review-verdicts.cjs').evaluateReadiness};
