import type {Snapshot,Task} from './shared';
const activeStatuses=new Set(['starting','working','running','in-progress','waiting','awaiting-approval','unknown']);
export function roomCrew(snapshot:Snapshot,projectId:string,crewId:string){
 const tasks=snapshot.tasks.filter(t=>t.projectId===projectId&&t.crewId===crewId);
 const approvals=new Set(snapshot.approvals.map(a=>a.taskId));
 const priority=(t:Task)=>approvals.has(t.id)?5:t.status==='unknown'?4:['waiting','awaiting-approval'].includes(t.status)?3:activeStatuses.has(t.status)?2:1;
 const task=tasks.slice().sort((a,b)=>priority(b)-priority(a)||b.updatedAt-a.updatedAt||a.id.localeCompare(b.id))[0];
 const mission=task?(snapshot.missions??[]).find(m=>m.projectId===projectId&&m.attempts.some(a=>a.id===m.activeAttemptId&&(a.taskId===task.id||a.taskIds.includes(task.id)))):undefined;
 const attempt=mission?.attempts.find(a=>a.id===mission.activeAttemptId);
 const phase=attempt?.workflow?.stages.find(s=>s.taskId===task?.id)?.id;
 const role=attempt?.taskId===task?.id?attempt?.routing?.roleId:undefined;
 const workLabel=phase==='plan'||role==='planner'?'Planning':phase==='review'||role==='reviewer'?'Reviewing':phase==='validate'||role==='validator'?'Validating':'Working';
 const activeCount=tasks.filter(t=>activeStatuses.has(t.status)||approvals.has(t.id)).length;
 let state='Idle';
 if(task){
  if(approvals.has(task.id))state='Needs you';
  else if(task.status==='unknown')state='Check connection';
  else if(['waiting','awaiting-approval'].includes(task.status))state='Waiting for input';
  else if(task.status==='starting')state='Starting';
  else if(activeStatuses.has(task.status))state=workLabel;
  else if(task.status==='failed')state='Failed';
  else if(task.status==='interrupted')state='Stopped';
  else if(['finished','completed'].includes(task.status))state=mission?.status==='COMPLETE'?'Mission complete':'Ready to review';
  else state='Ready';
 }
 const attention=['Needs you','Check connection','Waiting for input','Failed'].includes(state);
 return {task,mission,state,activeCount,attention,working:Boolean(task&&['working','running','in-progress'].includes(task.status)&&!approvals.has(task.id))};
}
export function roomSignals(snapshot:Snapshot,projectId:string,limit=8){
 return (snapshot.missions??[]).filter(m=>m.projectId===projectId).flatMap(m=>m.events.map(e=>({...e,missionId:m.id,revision:m.revision,title:m.title,seen:Boolean(m.seenEventIds?.includes(e.id))}))).sort((a,b)=>b.time-a.time||b.sequence-a.sequence).slice(0,limit);
}
