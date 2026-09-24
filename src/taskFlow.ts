import type {Project,Task} from './shared';

export type TaskPhase='attention'|'active'|'done';
export type TaskFamily={task:Task;children:Task[];phase:TaskPhase;updatedAt:number};
export function taskGuidance(task:Task):{detail:string;action:string}{
 if(task.status==='unknown')return {detail:'The connection was interrupted. Check status to find out whether work is still running.',action:'Check status'};
 if(['waiting','awaiting-approval'].includes(task.status))return {detail:'Your crew needs an answer or permission. Review the request below to continue.',action:'Review request'};
 if(task.status==='failed')return {detail:'This attempt failed. Review the error and saved conversation before deciding how to continue.',action:'Review failure'};
 if(task.status==='interrupted')return {detail:'Work is stopped. Review the saved progress, then send the next step when you are ready.',action:'Continue task'};
 if(task.status==='starting')return {detail:'Opening the crew’s conversation. Your task is already created; no need to send it again.',action:'Follow progress'};
 if(taskIsBusy(task))return {detail:'Your crew is working. You can read the activity and draft your next message while you wait.',action:'Follow progress'};
 if(['finished','completed'].includes(task.status))return {detail:'The crew has finished this turn. Review the reply and any changed files, then send a follow-up if needed.',action:'Open result'};
 return {detail:'This conversation is ready for your next message.',action:'Continue task'};
}
export function taskIsBusy(task:Task){return ['starting','working','running','in-progress','waiting','awaiting-approval','unknown'].includes(task.status);}
export function taskNeedsAttention(task:Task){return ['waiting','awaiting-approval','unknown','failed'].includes(task.status)||Boolean(task.error);}
export function taskLabel(task:Task){return ({starting:'Starting',working:'Working',running:'Working','in-progress':'Working',waiting:'Needs your input','awaiting-approval':'Needs approval',unknown:'Check connection',finished:'Ready to review',completed:'Ready to review',failed:'Needs attention',interrupted:'Stopped',idle:'Ready'} as Record<string,string>)[task.status]??task.status.replaceAll('-',' ');}
export function taskFamilies(tasks:Task[]):TaskFamily[]{
 const ids=new Set(tasks.map(task=>task.id));
 const children=new Map<string,Task[]>();
 for(const task of tasks)if(task.parentTaskId){const list=children.get(task.parentTaskId)??[];list.push(task);children.set(task.parentTaskId,list);}
 return tasks.filter(task=>!task.parentTaskId||!ids.has(task.parentTaskId)).map(task=>{
  const assignments=(children.get(task.id)??[]).sort((a,b)=>a.createdAt-b.createdAt),members=[task,...assignments];
  const phase:TaskPhase=members.some(taskNeedsAttention)?'attention':members.some(taskIsBusy)?'active':'done';
  return {task,children:assignments,phase,updatedAt:Math.max(...members.map(member=>member.updatedAt))};
 }).sort((a,b)=>b.updatedAt-a.updatedAt);
}
export function filterFamilies(families:TaskFamily[],filter:{query?:string;projectId?:string;phase?:string},projects:Pick<Project,'id'|'name'>[]){
 const query=filter.query?.trim().toLowerCase()??'';
 const names=new Map(projects.map(project=>[project.id,project.name]));
 return families.filter(family=>(!filter.phase||filter.phase==='all'||filter.phase===family.phase)&&(!filter.projectId||filter.projectId===family.task.projectId)&&(!query||[names.get(family.task.projectId),...[family.task,...family.children].flatMap(task=>[task.title,task.crewId])].join(' ').toLowerCase().includes(query)));
}
