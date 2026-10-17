import type {Snapshot,WorkContext} from './shared';
import {taskLabel} from './taskFlow.ts';
export function commandSignals(snapshot:Snapshot,context:WorkContext|null){
 const tasks=snapshot.tasks.filter(task=>!task.external&&(!context?.projectId||task.projectId===context.projectId)&&(!context?.runId||task.runId===context.runId));
 const updates=tasks.map(task=>({id:`task:${task.id}:${task.updatedAt}`,time:task.updatedAt,label:taskLabel(task),title:task.title,detail:task.lastAssistantPreview?.slice(0,220),taskId:task.id,missionId:undefined as string|undefined}));
 const missions=(snapshot.missions??[]).filter(mission=>(!context?.projectId||mission.projectId===context.projectId)&&(!context?.runId||mission.runId===context.runId));
 const events=missions.flatMap(mission=>mission.events.map(event=>({id:`mission:${mission.id}:${event.id}`,time:event.time,label:event.type.replaceAll('_',' ').toLowerCase(),title:mission.title,detail:undefined as string|undefined,taskId:undefined as string|undefined,missionId:mission.id})));
 return [...updates,...events].sort((a,b)=>b.time-a.time||a.id.localeCompare(b.id)).slice(0,12);
}
