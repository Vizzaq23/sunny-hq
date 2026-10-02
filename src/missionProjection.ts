import type {Mission,MissionAttempt,MissionResult,Snapshot,TaskSummary as Task,WorkContext} from './shared';
import {boundResultStatus,storageOutcomeUncertain} from './workContext.ts';

export type MissionProjectionState='idle'|'starting'|'working'|'input'|'approval'|'waiting'|'unknown'|'failed'|'stopped'|'review'|'accepted';
export type MissionStage='plan'|'work'|'validate'|'review';
export interface MissionProjection {
 missionId?:string;
 attemptId?:string;
 taskId?:string;
 crewId?:string;
 state:MissionProjectionState;
 label:string;
 working:boolean;
 acceptanceId?:string;
 acceptanceCueEligible?:boolean;
 result?:MissionResult;
 stage?:MissionStage;
}

const workStatuses=new Set(['working','running','in-progress']);
const stageLabels:Record<MissionStage,string>={plan:'Planning',work:'Working',validate:'Validating',review:'Reviewing'};
const roleStages:Record<string,MissionStage>={planner:'plan',builder:'work',designer:'work',researcher:'work',diagnostician:'work',creator:'work',operator:'work',validator:'validate',reviewer:'review'};
const stateLabels:Record<MissionProjectionState,string>={idle:'Idle',starting:'Starting',working:'Working',input:'Needs your input',approval:'Needs approval',waiting:'Waiting',unknown:'Check connection',failed:'Failed',stopped:'Stopped',review:'Ready to review',accepted:'Accepted by captain'};
const validId=(value:unknown):value is string=>typeof value==='string'&&Boolean(value.trim())&&value.length<=200&&!value.includes('\0');
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const unique=<T,>(values:T[]):T|undefined=>values.length===1?values[0]:undefined;
const isStage=(value:string):value is MissionStage=>Object.hasOwn(stageLabels,value);
const memberIds=(attempt:MissionAttempt)=>Array.isArray(attempt.taskIds)?attempt.taskIds:[];

function taskState(status:string):MissionProjectionState {
 if(workStatuses.has(status))return 'working';
 if(status==='awaiting-approval')return 'approval';
 if(status==='finished'||status==='completed')return 'review';
 if(status==='interrupted'||status==='stopped'||status==='cancelled')return 'stopped';
 if(['idle','starting','input','approval','waiting','unknown','failed'].includes(status))return status as MissionProjectionState;
 return 'unknown';
}

function selectedResult(snapshot:Snapshot,mission:Mission,attempt:MissionAttempt,members:Task[]):MissionResult|undefined {
 const result=mission.selectedResult;
 if(!result||!validId(result.id)||result.attemptId!==attempt.id||attempt.status!=='finished'||!Number.isFinite(result.selectedAt)||result.selectedAt<0||!memberIds(attempt).includes(result.producerTaskId)||!mission.taskIds.includes(result.producerTaskId))return;
 const producer=unique(members.filter(task=>task.id===result.producerTaskId));
 if(!producer||producer.external||producer.status!=='finished'||producer.projectId!==mission.projectId)return;
 const ref=result.ref;
 if(!ref||typeof ref.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256))return;
 if(ref.kind==='reply'){
  if(ref.taskId!==producer.id||!validId(ref.messageId))return;
 }else if(ref.kind==='deliverable'){
  if(!validId(ref.artifactId))return;
  const artifact=unique((mission.artifacts??[]).filter(value=>value.id===ref.artifactId));
  if(!artifact||!['deliverable','image'].includes(artifact.kind)||artifact.attemptId!==attempt.id||artifact.projectId!==mission.projectId||artifact.sha256!==ref.sha256)return;
 }else return;
 // Explicit main-held status verifies whole reply/file content. Missing pages cannot
 // disprove a result, and renderer previews cannot prove one.
 if(boundResultStatus(snapshot,mission)?.available!==true)return;
 return result;
}

function acceptanceId(mission:Mission,attempt:MissionAttempt,result:MissionResult|undefined):string|undefined {
 const receipt=mission.acceptance;
 if(mission.status!=='COMPLETE'||mission.activeAttemptId!==attempt.id||!receipt||receipt.legacy===true||!result||!validId(receipt.id)||receipt.actor!=='captain'||receipt.attemptId!==attempt.id||receipt.resultId!==result.id||receipt.resultSha256!==result.ref.sha256)return;
 if(!Number.isInteger(receipt.reviewedRevision)||receipt.reviewedRevision<0||receipt.reviewedRevision>mission.revision||!Number.isFinite(receipt.acceptedAt)||receipt.acceptedAt<0||!Array.isArray(receipt.criteria)||receipt.criteria.length!==mission.acceptanceCriteria.length||!receipt.criteria.every(value=>value===true))return;
 return receipt.id;
}

/** A read-only projection of the supplied selection; recency never chooses work. */
export function projectMission(snapshot:Snapshot,context:WorkContext):MissionProjection {
 const identity:Pick<MissionProjection,'missionId'|'attemptId'|'taskId'|'crewId'|'stage'>={};
 if(context?.missionId!==undefined)identity.missionId=context.missionId;
 if(context?.attemptId!==undefined)identity.attemptId=context.attemptId;
 if(context?.taskId!==undefined)identity.taskId=context.taskId;
 const show=(state:MissionProjectionState,label=stateLabels[state]):MissionProjection=>({...identity,state,label,working:state==='working'});
 const unavailable=(item:string)=>show('unknown',`${item} unavailable. Your selection is retained.`);
 if(!record(context)||!record(snapshot)||!validId(context.projectId)||!Array.isArray(snapshot.projects)||snapshot.projects.some(project=>!record(project))||!unique(snapshot.projects.filter(project=>project.id===context.projectId)))return unavailable('Project');
 if(['missionId','attemptId','taskId'].some(key=>context[key as 'missionId'|'attemptId'|'taskId']!==undefined&&!validId(context[key as 'missionId'|'attemptId'|'taskId'])))return unavailable('Selection');
 if(!Array.isArray(snapshot.tasks)||snapshot.tasks.some(task=>!record(task)||!validId(task.id)||!validId(task.projectId)||!validId(task.crewId)||typeof task.status!=='string')||!Array.isArray(snapshot.approvals)||snapshot.approvals.some(value=>!record(value))||snapshot.missions!==undefined&&(!Array.isArray(snapshot.missions)||snapshot.missions.some(value=>!record(value))))return unavailable('Snapshot');
 const tasks=snapshot.tasks;
 const missions=snapshot.missions??[];
 let mission:Mission|undefined;
 let attempt:MissionAttempt|undefined;
 let task:Task|undefined;

 if(context.taskId!==undefined){
  task=unique(tasks.filter(value=>value.id===context.taskId));
  if(!task||task.projectId!==context.projectId)return unavailable('Task');
  if(task.external)return unavailable('Read-only task');
  identity.crewId=task.crewId;
 }
 if(context.missionId!==undefined){
  mission=unique(missions.filter(value=>value.id===context.missionId));
  if(!mission||mission.projectId!==context.projectId||!Array.isArray(mission.attempts)||!Array.isArray(mission.taskIds))return unavailable('Mission');
 }else if(context.attemptId!==undefined||task){
  const owners=missions.filter(value=>value.projectId===context.projectId&&Array.isArray(value.attempts)).flatMap(value=>value.attempts.filter(a=>context.attemptId!==undefined?a.id===context.attemptId:memberIds(a).includes(task!.id)).map(a=>({mission:value,attempt:a})));
  if(owners.length>1)return unavailable('Attempt');
  if(owners.length===1){mission=owners[0].mission;attempt=owners[0].attempt;}
  else if(context.attemptId!==undefined)return unavailable('Attempt');
  else if(task&&missions.some(value=>value.projectId===context.projectId&&Array.isArray(value.taskIds)&&value.taskIds.includes(task!.id)))return unavailable('Attempt membership');
 }
 if(mission){
  identity.missionId=mission.id;
  if(context.attemptId!==undefined)attempt=unique(mission.attempts.filter(value=>value.id===context.attemptId));
  else if(task)attempt=unique(mission.attempts.filter(value=>memberIds(value).includes(task!.id)));
  else if(mission.activeAttemptId!==undefined)attempt=unique(mission.attempts.filter(value=>value.id===mission.activeAttemptId));
  if(!attempt){
   if(context.attemptId!==undefined||task||mission.activeAttemptId!==undefined||mission.attempts.length)return unavailable('Attempt');
   return mission.status==='DRAFT'?show('idle','Ready to start'):unavailable('Attempt');
  }
  identity.attemptId=attempt.id;
  const ids=memberIds(attempt);
  if(!validId(attempt.taskId)||!ids.includes(attempt.taskId)||ids.some(id=>!validId(id)||!mission!.taskIds.includes(id))||new Set(ids).size!==ids.length)return unavailable('Attempt membership');
  if(task&&!ids.includes(task.id))return unavailable('Task');
  const members:Task[]=[];
  for(const id of ids){
   const member=unique(tasks.filter(value=>value.id===id));
   if(!member||member.external||member.projectId!==context.projectId)return unavailable('Attempt task');
   members.push(member);
  }
  let pendingStage=false;
  let coordinatorPending=false;
  let missingStageResult=false;
  if(attempt.workflow){
   if(!Array.isArray(attempt.workflow.stages)||!attempt.workflow.stages.length||attempt.workflow.stages.some(value=>!record(value)||!isStage(value.id)||value.status==='complete'&&value.taskId===undefined)||new Set(attempt.workflow.stages.map(value=>value.id)).size!==attempt.workflow.stages.length)return unavailable('Workflow');
   coordinatorPending=!task&&attempt.workflow.stages.every(value=>value.status==='complete')&&!['finished','failed','interrupted'].includes(attempt.status);
   const stage=task?unique(attempt.workflow.stages.filter(value=>value.taskId===task!.id)):coordinatorPending?undefined:attempt.workflow.stages.find(value=>value.status!=='complete')??attempt.workflow.stages.at(-1);
   if(stage){
    identity.stage=stage.id as MissionStage;
    missingStageResult=stage.status==='result-missing';
    if(!task){
     if(stage.taskId!==undefined){
      task=unique(members.filter(value=>value.id===stage.taskId));
      if(!task)return unavailable('Stage task');
     }else pendingStage=true;
    }
   }
  }
  if(!task)task=unique(members.filter(value=>value.id===attempt!.taskId));
  if(!task)return unavailable('Task');
  identity.taskId=task.id;identity.crewId=task.crewId;
  if(!identity.stage&&task.id===attempt.taskId&&attempt.routing)identity.stage=roleStages[attempt.routing.roleId];
  const requests=(snapshot.approvals??[]).filter(value=>value.taskId!==undefined&&ids.includes(value.taskId));
  if(requests.some(value=>value.method!=='item/tool/requestUserInput')||members.some(value=>value.status==='awaiting-approval'))return show('approval');
  if(requests.length)return show('input');
  const current=mission.activeAttemptId===attempt.id;
  if(current&&storageOutcomeUncertain(snapshot))return show('unknown','Storage outcome uncertain; restart to recover saved work');
  if(current&&mission.acceptancePending)return show('unknown','Acceptance pending storage recovery');
  if(missingStageResult)return unavailable('Stage result');
  if(attempt.status==='unknown'||members.some(value=>taskState(value.status)==='unknown')||current&&mission.connection==='reconciling')return show('unknown');
  if(current&&(mission.mergeRequest?.attemptId===attempt.id&&['uncertain','submitting'].includes(mission.mergeRequest.state)||mission.prPublication?.attemptId===attempt.id&&mission.prPublication.state==='uncertain'))return show('unknown');
  if(current&&mission.checkExecution?.attemptId===attempt.id){identity.stage='validate';return show('waiting','Project check running');}
  if(current&&mission.status==='NEEDS_USER')return show('input');
  if(current&&mission.status==='BLOCKED')return show('waiting','Blocked; inspect saved work');
  if(attempt.status==='failed'||members.some(value=>value.status==='failed')||current&&mission.status==='FAILED')return show('failed');
  if(attempt.status==='interrupted'||members.some(value=>value.status==='interrupted')||current&&mission.status==='CANCELLED')return show('stopped');
  const result=selectedResult(snapshot,mission,attempt,members);
  const receiptId=acceptanceId(mission,attempt,result);
  if(receiptId)return {...show('accepted'),acceptanceId:receiptId,acceptanceCueEligible:snapshot.liveAcceptanceIds?.includes(receiptId)===true,result};
  if(current&&mission.status==='COMPLETE')return show('review',mission.acceptance?.legacy===true?'Historical completion; result unavailable':'Acceptance unavailable; inspect saved result');
  if(attempt.status==='finished'||current&&mission.status==='WAITING_FOR_REVIEW')return {...show('review'),...(result?{result}:{})};
  if(coordinatorPending)return show('waiting','Waiting for coordinator result');
  if(pendingStage)return show('waiting',`Waiting for ${identity.stage??'next'} stage`);
  if(attempt.status==='waiting')return show('waiting');
  const state=taskState(task.status);
  return show(state,state==='working'&&identity.stage?stageLabels[identity.stage]:stateLabels[state]);
 }

 if(!task)return show('idle');
 identity.taskId=task.id;identity.crewId=task.crewId;
 const requests=(snapshot.approvals??[]).filter(value=>value.taskId===task.id);
 if(requests.some(value=>value.method!=='item/tool/requestUserInput')||task.status==='awaiting-approval')return show('approval');
 if(requests.length)return show('input');
 return show(taskState(task.status));
}
