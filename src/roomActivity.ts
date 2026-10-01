import type {Snapshot,Task,WorkContext} from './shared';
import {projectMission,type MissionProjection} from './missionProjection.ts';
const activeStatuses=new Set(['starting','working','running','in-progress','waiting','awaiting-approval','unknown']);
export function roomCrew(snapshot:Snapshot,projectId:string,crewId:string,context:WorkContext|null|undefined=snapshot.workspace?.context){
 const tasks=snapshot.tasks.filter(t=>t.projectId===projectId&&t.crewId===crewId);
 const approvals=new Set(snapshot.approvals.map(a=>a.taskId));
 const priority=(t:Task)=>approvals.has(t.id)?5:t.status==='unknown'?4:['waiting','awaiting-approval'].includes(t.status)?3:activeStatuses.has(t.status)?2:1;
 const selected=tasks.slice().sort((a,b)=>priority(b)-priority(a)||b.updatedAt-a.updatedAt||a.id.localeCompare(b.id))[0];
 const projection=projectMission(snapshot,context?.projectId===projectId?context:{projectId,taskId:selected?.id,surface:'deck',returnTo:{view:'ship'}});
 const task=projection.crewId===crewId?snapshot.tasks.find(t=>t.id===projection.taskId):undefined;
 const mission=(snapshot.missions??[]).find(m=>m.projectId===projectId&&m.id===projection.missionId);
 const activeCount=tasks.filter(t=>activeStatuses.has(t.status)||approvals.has(t.id)).length;
 const state=!task?(projection.state==='unknown'?projection.label:'Idle'):projection.state==='approval'?'Needs you':projection.state==='input'||projection.state==='waiting'?'Waiting for input':projection.state==='accepted'?'Mission accepted':projection.state==='review'&&projection.label==='Historical completion; result unavailable'?'Historical completion; result unavailable':projection.label;
 const attention=projection.state==='unknown'||['Needs you','Check connection','Waiting for input','Failed'].includes(state);
 return {task,mission,state,activeCount,attention,working:Boolean(task&&projection.working),projection};
}
export function roomRequest(snapshot:Snapshot,projection:MissionProjection){
 const mission=snapshot.missions?.find(m=>m.id===projection.missionId),attempt=mission?.attempts.find(a=>a.id===projection.attemptId);
 return snapshot.approvals.find(a=>a.taskId&&(attempt?attempt.taskIds.includes(a.taskId):a.taskId===projection.taskId)&&(projection.state==='approval'?a.method!=='item/tool/requestUserInput':projection.state==='input'&&a.method==='item/tool/requestUserInput'));
}
export function roomSignals(snapshot:Snapshot,projectId:string,limit=8){
 return (snapshot.missions??[]).filter(m=>m.projectId===projectId).flatMap(m=>m.events.map(e=>({...e,missionId:m.id,revision:m.revision,title:m.title,seen:Boolean(m.seenEventIds?.includes(e.id))}))).sort((a,b)=>b.time-a.time||b.sequence-a.sequence).slice(0,limit);
}
