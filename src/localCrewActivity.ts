import type {Snapshot,WorkContext} from './shared';
import type {MissionProjection} from './missionProjection';
const active=new Set(['planning','working','reviewing','synthesizing']);
/** Local advice is visible activity, never an accepted mission or simulated tool execution. */
export function localCrewActivity(snapshot:Snapshot,crewId:string,context?:WorkContext|null):MissionProjection|undefined{
 if(crewId==='morgans'||context?.runId||context?.taskId||context?.missionId||context?.attemptId)return;
 // A real executing/uncertain task retains priority over local advisory animation.
 if(snapshot.tasks.some(task=>task.crewId===crewId&&!task.external&&['starting','working','waiting','unknown'].includes(task.status)))return;
 const record=snapshot.localCrew?.councils?.find(item=>active.has(item.status)&&(!context?.projectId||item.projectId===context.projectId));
 if(record){
  if(crewId==='zoro'&&record.status==='reviewing'&&record.review?.status==='working')return {crewId,state:'working',working:true,label:'Cross-checking local crew proposals'};
  if(crewId==='luffy')return {crewId,state:['working','reviewing'].includes(record.status)?'waiting':'working',working:!['working','reviewing'].includes(record.status),label:record.status==='planning'?'Choosing the crew locally':record.status==='synthesizing'?'Combining actual crew reports':record.status==='reviewing'?'Waiting for Zoro’s cross-review':'Waiting for local crew reports'};
  const contribution=record.contributions.find(item=>item.crewId===crewId);
  if(contribution)return {crewId,state:contribution.status==='working'?'working':contribution.status==='failed'?'failed':'waiting',working:contribution.status==='working',label:contribution.status==='working'?'Thinking locally · '+(contribution.model||snapshot.localCrew?.profiles[crewId]?.model||'local model'):contribution.status==='queued'?'Queued for local advice':contribution.status==='ready'?'Local advice ready · not executed':contribution.status==='failed'?'Local reply failed':'Local reply interrupted'};
 }
 const session=snapshot.localCrew?.profiles[crewId]?.sessions.find(item=>item.status==='working'&&(!context?.projectId||item.projectId===context.projectId));
 if(session)return {crewId,state:'working',working:true,label:'Thinking locally · personal conversation'};
}
