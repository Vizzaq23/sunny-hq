import type {Snapshot,TaskSummary} from './shared';
import {storageOutcomeUncertain} from './workContext.ts';
export type WatchLane='attention'|'active'|'review';
export interface WatchItem {id:string;lane:WatchLane;label:string;title:string;detail:string;action:string;projectId:string;crewId?:string;taskId?:string;missionId?:string;attemptId?:string;updatedAt:number;requestCount:number;}
const live=new Set(['starting','working','running','in-progress','waiting','awaiting-approval','unknown']);
const clip=(value:unknown)=>typeof value==='string'?value.slice(0,240)+(value.length>240?'…':''):'';
const inputRequest=(method:string)=>['item/tool/requestUserInput','mcpServer/elicitation/request'].includes(method);
function owner(snapshot:Snapshot,task:TaskSummary){
 const matches=(snapshot.missions??[]).filter(m=>m.projectId===task.projectId&&m.taskIds.includes(task.id));
 const mission=matches.length===1?matches[0]:undefined,attempt=mission?.attempts.find(a=>a.id===mission.activeAttemptId);
 return {mission,attempt,historical:matches.length>1||Boolean(mission&&!attempt?.taskIds.includes(task.id))};
}
/** Snapshot facts only: prose, tool completion and animation never grant completion. */
export function captainWatch(snapshot:Snapshot):WatchItem[]{
 const items:WatchItem[]=[],uncertain=storageOutcomeUncertain(snapshot),connected=snapshot.codex.status==='connected';
 for(const task of snapshot.tasks){
  if(task.external)continue;
  const {mission,attempt,historical}=owner(snapshot,task),requests=snapshot.approvals.filter(a=>a.taskId===task.id);
  if(historical&&!requests.length)continue;
  if(!live.has(task.status)&&task.status!=='failed'&&!requests.length)continue;
  const run=snapshot.runs?.find(r=>r.id===(task.runId??mission?.runId));
  const base={id:'task:'+task.id,title:task.title,projectId:task.projectId,crewId:task.crewId,taskId:task.id,missionId:historical?undefined:mission?.id,attemptId:historical?undefined:attempt?.id,updatedAt:task.updatedAt,requestCount:requests.length};
  if(uncertain||!connected||task.status==='unknown'||run?.phase==='unknown'||Boolean(run?.controlReport?.unknownEffects.length)||mission?.connection==='reconciling'||historical||requests.length&&!live.has(task.status)){
   items.push({...base,lane:'attention',label:uncertain?'Storage needs recovery':'Check connection',detail:uncertain?'Saved work is uncertain. Inspect recovery before continuing.':historical?'A request belongs to an older attempt. Inspect its saved context before acting.':'Current execution is unconfirmed. Check task status; no work is restarted here.',action:'Inspect recovery'});continue;
  }
  if(run&&(['paused','stopping','stopped','blocked'].includes(run.phase)||run.controlIntent?.state==='pending')){items.push({...base,lane:'attention',label:run.phase==='paused'?'Run paused':run.phase==='stopped'?'Run stopped':'Run needs attention',detail:'Inspect run control and saved work before continuing.',action:'Inspect work'});continue;}
  if(requests.length){
   const permission=requests.some(a=>!inputRequest(a.method)),first=requests.find(a=>!inputRequest(a.method))??requests[0];
   const question=Array.isArray(first.params?.questions)?first.params.questions[0]?.question:undefined;
   items.push({...base,lane:'attention',label:permission?'Permission requested':'Crew needs an answer',detail:clip(first.params?.command)||clip(question)||clip(first.params?.message)||clip(first.params?.reason)||'Open the exact request and its scope before responding.',action:permission?'Review request':'Answer crew'});continue;
  }
  if(task.status==='failed'){items.push({...base,lane:'attention',label:'Attempt failed',detail:clip(task.error)||'Inspect the saved error before deciding what to retry.',action:'Review issue'});continue;}
  const waiting=['waiting','awaiting-approval'].includes(task.status);
  items.push({...base,lane:'active',label:waiting?'Waiting — no request received':task.status==='starting'?'Starting':'Working',detail:waiting?'The provider reports waiting. No actionable request is present in this snapshot.':clip(task.latestActivity)||'Follow the recorded activity in the workbench.',action:'Inspect work'});
 }
 for(const mission of snapshot.missions??[]){
  if(mission.status!=='WAITING_FOR_REVIEW')continue;
  const attempt=mission.attempts.find(a=>a.id===mission.activeAttemptId);if(!attempt)continue;
  if(items.some(item=>item.missionId===mission.id&&item.lane==='attention'))continue;
  const run=snapshot.runs?.find(r=>r.id===mission.runId),recovery=uncertain||mission.connection==='reconciling'||run?.phase==='unknown'||Boolean(run?.controlReport?.unknownEffects.length);
  for(let i=items.length-1;i>=0;i--)if(items[i].missionId===mission.id&&items[i].lane==='active')items.splice(i,1);
  items.push({id:'mission:'+mission.id,lane:recovery?'attention':'review',label:recovery?'Inspect saved goal':!connected?'Saved result — offline':'Captain review needed',title:mission.title,detail:recovery?'Reconcile saved state before reviewing this result.':!connected?'A saved result is awaiting review. The provider is not connected; inspect its evidence before any decision.':'The attempt is ready for review. Inspect the result and checks; captain acceptance is separate.',action:'Review goal',projectId:mission.projectId,missionId:mission.id,attemptId:attempt.id,updatedAt:mission.updatedAt,requestCount:0});
 }
 const order={attention:0,review:1,active:2};
 return items.sort((a,b)=>order[a.lane]-order[b.lane]||b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
}
