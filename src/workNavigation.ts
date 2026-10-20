import type {Approval,Project,TaskSummary} from './shared';
import {taskIsBusy,taskNeedsAttention} from './taskFlow.ts';
export type InboxLane='attention'|'active'|'review'|'history';
export const inboxLanes: {id:InboxLane;label:string;description:string}[]=[
 {id:'attention',label:'Needs you',description:'Requests, errors and uncertain connections.'},
 {id:'active',label:'Underway',description:'Follow the crew’s current work.'},
 {id:'review',label:'Ready to review',description:'Finished turns; results still need your review.'},
 {id:'history',label:'Logbook',description:'Stopped and idle conversations.'}
];
export function inboxLane(task:TaskSummary,approvals:Approval[]):InboxLane{
 if(approvals.some(a=>a.taskId===task.id)||taskNeedsAttention(task))return 'attention';
 if(taskIsBusy(task))return 'active';
 if(['finished','completed'].includes(task.status))return 'review';
 return 'history';
}
export function searchLocalTasks(tasks:TaskSummary[],projects:Project[],crew:{id:string;name:string}[],query:string,projectId='',crewId=''){
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const projectNames=new Map(projects.map(p=>[p.id,p.name])),crewNames=new Map(crew.map(c=>[c.id,c.name]));
 return tasks.filter(t=>!t.external&&(!projectId||t.projectId===projectId)&&(!crewId||t.crewId===crewId)).filter(t=>{
  const haystack=[t.title,projectNames.get(t.projectId),crewNames.get(t.crewId),t.status,t.lastAssistantPreview,t.latestActivity].join(' ').toLocaleLowerCase();
  return terms.every(term=>haystack.includes(term));
 }).sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
}
