import type {Snapshot} from './shared';
import {delegationSignals} from './crewDelegation.ts';
import {taskLabel} from './taskFlow.ts';

export type ShipLogKind='delegation'|'work'|'review'|'check'|'mission';
export interface ShipLogEntry {
 id:string;time:number;timeLabel?:string;projectId:string;crewId?:string;kind:ShipLogKind;
 title:string;label:string;detail:string;source:string;taskId?:string;missionId?:string;attemptId?:string;
}
export function shipLogEntries(snapshot:Snapshot):ShipLogEntry[]{
 const tasks=new Map(snapshot.tasks.filter(t=>!t.external).map(t=>[t.id,t]));
 const rows:ShipLogEntry[]=delegationSignals(snapshot).map(signal=>({
  ...signal,kind:'delegation',source:signal.taskId?'Delegated conversation':'Local council',
  projectId:signal.projectId,label:signal.direction==='outbound'?'Assignment recorded':'Reply returned · review needed'
 }));
 for(const task of tasks.values())rows.push({id:`work:${task.id}`,time:task.updatedAt,timeLabel:'Latest conversation update',projectId:task.projectId,crewId:task.crewId,kind:'work',title:task.title,label:taskLabel(task),detail:task.error||task.lastAssistantPreview||'No saved reply yet.',source:'Conversation '+task.id,taskId:task.id});
 for(const council of snapshot.localCrew?.councils??[]){
  if(council.review?.text)rows.push({id:`review:${council.id}`,time:council.updatedAt,timeLabel:'Council last updated',projectId:council.projectId,crewId:'zoro',kind:'review',title:council.objective,label:`Local review · ${council.review.status}`,detail:council.review.text,source:'Local council '+council.id});
 }
 for(const mission of snapshot.missions??[]){
  const base={projectId:mission.projectId,missionId:mission.id,title:mission.title};
  for(const event of mission.events)rows.push({...base,id:`event:${mission.id}:${event.id}`,time:event.time,kind:'mission',label:event.type.replaceAll('_',' ').toLowerCase(),detail:`Recorded event ${event.id}\nSequence ${event.sequence}`,source:'Mission '+mission.id});
  for(const review of mission.reviewDecisions??[])rows.push({...base,id:`review:${mission.id}:${review.id}`,time:review.time,kind:'review',label:review.decision==='accepted'?'Captain accepted this attempt':'Captain requested changes',detail:review.note||'No review note recorded.',source:`Captain review ${review.id} · revision ${review.reviewedRevision}`,attemptId:review.attemptId});
  for(const artifact of mission.artifacts){
   if(artifact.projectId!==mission.projectId)continue;
   const producer=tasks.get(artifact.producer);
   rows.push({...base,id:`artifact:${mission.id}:${artifact.id}`,time:artifact.recordedAt,kind:artifact.kind==='check'?'check':'mission',crewId:producer?.projectId===mission.projectId?producer.crewId:undefined,label:artifact.kind==='check'?`Check · ${artifact.status??'recorded'}`:`${artifact.kind.replaceAll('-',' ')} recorded`,detail:[artifact.script,artifact.command,artifact.filePath,artifact.commit?`Commit ${artifact.commit}`:undefined,artifact.exitCode!==undefined?`Exit code ${artifact.exitCode}`:undefined].filter(Boolean).join('\n')||'Open the mission to inspect this recorded artifact.',source:'Artifact '+artifact.id,attemptId:artifact.attemptId});
  }
 }
 return rows.sort((a,b)=>b.time-a.time||a.id.localeCompare(b.id));
}

export function filterShipLog(rows:ShipLogEntry[],query:string,projectId:string,kind:ShipLogKind|'all',crewNames:Map<string,string>){
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return rows.filter(row=>(!projectId||row.projectId===projectId)&&(kind==='all'||row.kind===kind)&&terms.every(term=>`${row.title} ${row.label} ${row.detail} ${crewNames.get(row.crewId??'')??''}`.toLocaleLowerCase().includes(term)));
}
