import type {Snapshot,TaskSummary as Task,WorkContext,SupervisedAssignmentSummary} from './shared';
import {projectMission,type MissionProjection} from './missionProjection.ts';
import {projectRun} from './runProjection.ts';
import {storageOutcomeUncertain} from './workContext.ts';
import {localCrewActivity} from './localCrewActivity.ts';
const activeStatuses=new Set(['starting','working','running','in-progress','waiting','awaiting-approval','unknown']);
const roleStages:Record<string,string>={nami:'plan',franky:'work',zoro:'review',usopp:'validate',sanji:'work',chopper:'work',robin:'work',brook:'work',jinbe:'work'};
function reviewSceneAssignment(assignment:SupervisedAssignmentSummary|undefined){
 // Main admits canonical review assignments by selected capability. The one
 // canonical review-only role is a conservative fallback for older summaries.
 return assignment?.capability==='review'||assignment?.crewId==='zoro'&&assignment.roleId==='reviewer'&&assignment.capability===undefined;
}
export function crewSceneStatus(projection:MissionProjection){
 if(projection.stage==='review')return 'waiting';
 if(projection.working&&projection.state==='working'&&projection.stage&&roleStages[projection.crewId??'']&&roleStages[projection.crewId!]!==projection.stage)return 'waiting';
 return projection.state==='working'&&projection.working?'working':['unknown','failed'].includes(projection.state)?'attention':projection.state==='idle'?'idle':'waiting';
}
/** One read-only activity per identity, scoped to the retained selection. */
export function crewSceneProjection(snapshot:Snapshot,crewId:string,context:WorkContext|null|undefined=snapshot.workspace?.context):MissionProjection {
 const idle=(label='Standing by for selected work'):MissionProjection=>({crewId,state:'idle',label,working:false});
 const local=localCrewActivity(snapshot,crewId,context);if(local)return storageOutcomeUncertain(snapshot)?{...local,state:'unknown',working:false,label:'Local work · storage needs recovery'}:local;
 if(crewId==='morgans')return idle('Read-only reports · News blimp');
 if(context?.runId){
  const view=projectRun(snapshot,context.runId),run=view.run;
  if(!run||run.projectId!==context.projectId)return {...idle(),state:'unknown',label:'Run unavailable. Your selection is retained.'};
  let exact:MissionProjection|undefined;
  if(context.taskId||context.missionId||context.attemptId){exact=projectMission(snapshot,context);if(exact.state==='unknown')return {...exact,crewId,working:false};}
  const member=view.crew.find(c=>c.id===crewId),task=snapshot.tasks.find(t=>t.id===member?.taskId);
  if(exact?.missionId){
   const mission=snapshot.missions?.find(m=>m.id===exact.missionId),attempt=mission?.attempts.find(a=>a.id===exact.attemptId);
   if(mission?.runId!==run.id||!attempt)return {...idle(),state:'unknown',label:'Run mission unavailable'};
   if(mission.activeAttemptId!==attempt.id)return exact.crewId===crewId?{...exact,working:false}:idle('Standing by for selected historical work');
   let ancestor=task;const visited=new Set<string>();
   while(ancestor&&!attempt.taskIds.includes(ancestor.id)&&!visited.has(ancestor.id)){visited.add(ancestor.id);ancestor=snapshot.tasks.find(t=>t.id===ancestor!.parentTaskId&&t.projectId===run.projectId&&t.runId===run.id);}
   if(task&&(!ancestor||!attempt.taskIds.includes(ancestor.id)))return idle('Standing by for selected attempt');
  }
  if(context.taskId){if(exact?.crewId!==crewId)return idle();if(context.taskId!==member?.taskId)return {...exact!,working:false};}
  if(member?.label==='Assignments ambiguous')return {...idle(),state:'unknown',label:member.label};
  // Coordinators need no worker assignment. Keep exact verified acceptance
  // only when the run projection also confirms it, without inventing activity.
  if(!member?.taskId){
   if(exact?.crewId!==crewId)return idle(member?.label??view.label);
   if(exact.state==='accepted'&&view.label==='Accepted by captain')return exact;
   // Retain selection while proof loads so live acceptance is a transition
   // within this mission, never a cue borrowed from a newly selected mission.
   return {...idle(member?.label??view.label),missionId:exact.missionId,attemptId:exact.attemptId,taskId:exact.taskId};
  }
  if(!task||task.projectId!==run.projectId||task.crewId!==crewId||task.runId!==run.id||task.external)return {...idle(),state:'unknown',label:'Assignment task unavailable'};
  const projection=projectMission(snapshot,{...context,missionId:undefined,attemptId:undefined,taskId:task.id});
  if(!member.working&&projection.working){const state=view.label.includes('unknown')||view.label.includes('recovery')?'unknown':run.phase==='stopped'?'stopped':run.phase==='ready'?'review':'waiting';return {...projection,state,label:view.working?member.label:view.label,working:false};}
  const assignment=run.assignments.find(a=>a.crewId===crewId&&a.taskId===member.taskId&&a.state==='working');
  if(member.working&&projection.working&&reviewSceneAssignment(assignment))return {...projection,stage:'review',label:'Reviewing',working:false};
  if(run.phase==='reviewing'&&projection.working)return {...projection,state:'waiting',label:'Waiting during independent review',working:false};
  return {...projection,working:member.working&&projection.working};
 }
 if(context){const selected=projectMission(snapshot,context),task=snapshot.tasks.find(t=>t.id===selected.taskId),mission=snapshot.missions?.find(m=>m.id===selected.missionId),runId=task?.runId??mission?.runId;if(runId&&selected.state!=='unknown')return crewSceneProjection(snapshot,crewId,{...context,runId});return selected.crewId===crewId?{...selected,working:selected.working&&!storageOutcomeUncertain(snapshot)}:selected.state==='unknown'?{...selected,crewId,working:false}:idle();}
 const tasks=snapshot.tasks.filter(t=>t.crewId===crewId&&!t.external),approvals=new Set(snapshot.approvals.map(a=>a.taskId));
 const rank=(t:Task)=>approvals.has(t.id)?5:t.status==='unknown'?4:['waiting','awaiting-approval','input'].includes(t.status)?3:activeStatuses.has(t.status)?2:1;
 const task=tasks.slice().sort((a,b)=>rank(b)-rank(a)||b.updatedAt-a.updatedAt||a.id.localeCompare(b.id))[0];
 if(!task)return idle('Idle');
 // A task attached to a supervised run cannot escape the run's stop/recovery gate.
 if(task.runId)return crewSceneProjection(snapshot,crewId,{projectId:task.projectId,runId:task.runId,taskId:task.id,surface:'deck',returnTo:{view:'ship'}});
 const projection=projectMission(snapshot,{projectId:task.projectId,taskId:task.id,surface:'deck',returnTo:{view:'ship'}});
 return {...projection,working:projection.working&&!storageOutcomeUncertain(snapshot)};
}
export function roomCrew(snapshot:Snapshot,projectId:string,crewId:string,context:WorkContext|null|undefined=snapshot.workspace?.context){
 const tasks=snapshot.tasks.filter(t=>t.projectId===projectId&&t.crewId===crewId);
 const approvals=new Set(snapshot.approvals.map(a=>a.taskId));
 const priority=(t:Task)=>approvals.has(t.id)?5:t.status==='unknown'?4:['waiting','awaiting-approval'].includes(t.status)?3:activeStatuses.has(t.status)?2:1;
 const selected=tasks.slice().sort((a,b)=>priority(b)-priority(a)||b.updatedAt-a.updatedAt||a.id.localeCompare(b.id))[0];
 const projection=crewSceneProjection(snapshot,crewId,context??{projectId,runId:selected?.runId,taskId:selected?.id,surface:'deck',returnTo:{view:'ship'}});
 const task=projection.crewId===crewId?snapshot.tasks.find(t=>t.id===projection.taskId&&t.projectId===projectId&&t.crewId===crewId):undefined;
 const mission=(snapshot.missions??[]).find(m=>m.projectId===projectId&&m.id===projection.missionId);
 const activeCount=tasks.filter(t=>activeStatuses.has(t.status)||approvals.has(t.id)).length;
 const state=!task?(projection.state==='unknown'?projection.label:'Idle'):projection.state==='approval'?'Needs you':projection.state==='input'||projection.state==='waiting'?'Waiting for input':projection.state==='accepted'?'Mission accepted':projection.state==='review'&&projection.label==='Historical completion; result unavailable'?'Historical completion; result unavailable':projection.label;
 const attention=projection.state!=='idle'&&crewSceneStatus(projection)!=='working';
 return {task,mission,state,activeCount,attention,working:Boolean(task&&crewSceneStatus(projection)==='working'),projection};
}
export function roomRequest(snapshot:Snapshot,projection:MissionProjection){
 const mission=snapshot.missions?.find(m=>m.id===projection.missionId),attempt=mission?.attempts.find(a=>a.id===projection.attemptId);
 return snapshot.approvals.find(a=>a.taskId&&(attempt?attempt.taskIds.includes(a.taskId):a.taskId===projection.taskId)&&(projection.state==='approval'?a.method!=='item/tool/requestUserInput':projection.state==='input'&&a.method==='item/tool/requestUserInput'));
}
export function roomSignals(snapshot:Snapshot,projectId:string,limit=8){
 return (snapshot.missions??[]).filter(m=>m.projectId===projectId).flatMap(m=>m.events.map(e=>({...e,missionId:m.id,revision:m.revision,title:m.title,seen:Boolean(m.seenEventIds?.includes(e.id))}))).sort((a,b)=>b.time-a.time||b.sequence-a.sequence).slice(0,limit);
}
