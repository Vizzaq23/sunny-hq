import type {Mission,MissionResultRef,MissionResultStatus,Snapshot,WorkContext} from './shared';
export function taskWorkSelection(snapshot:Snapshot,init:{projectId?:string;runId?:string;missionId?:string;attemptId?:string;taskId?:string},context:WorkContext|null){
 const task=snapshot.tasks.find(t=>t.id===init.taskId),runId=init.runId??task?.runId;const ancestry:string[]=[];let owner=task;while(owner&&!ancestry.includes(owner.id)){ancestry.push(owner.id);owner=snapshot.tasks.find(t=>t.id===owner?.parentTaskId);}
 const mission=snapshot.missions?.find(m=>init.missionId?m.id===init.missionId:(!runId||m.runId===runId)&&m.taskIds.some(id=>ancestry.includes(id)))??(runId&&context?.runId===runId?snapshot.missions?.find(m=>m.id===context.missionId&&m.runId===runId):undefined);
 const attempt=mission?.attempts.find(a=>init.attemptId?a.id===init.attemptId:a.taskIds.some(id=>ancestry.includes(id)))??(runId&&context?.runId===runId?mission?.attempts.find(a=>a.id===context.attemptId):!task?mission?.attempts.find(a=>a.id===mission.activeAttemptId):undefined);
 return {projectId:init.projectId??task?.projectId??mission?.projectId,runId:runId??mission?.runId,missionId:mission?.id??init.missionId,attemptId:init.attemptId??attempt?.id,taskId:init.taskId};
}
export function resolveWorkContext(context:WorkContext|null,snapshot:Snapshot):{context:WorkContext|null;unavailable?:string}{
 if(!context)return {context:null};
 const unavailable=(item:string)=>({context,unavailable:`${item} unavailable. Your saved selection is retained.`});
 if(!snapshot.projects.some(p=>p.id===context.projectId))return unavailable('Project');
 const run=context.runId?snapshot.runs?.find(r=>r.id===context.runId):undefined;if(context.runId&&(!run||run.projectId!==context.projectId))return unavailable('Run');
 const mission=context.missionId?(snapshot.missions??[]).find(m=>m.id===context.missionId):undefined;
 if(context.missionId&&(!mission||mission.projectId!==context.projectId||run&&mission.runId!==run.id))return unavailable('Mission');
 const attempt=context.attemptId?mission?.attempts.find(a=>a.id===context.attemptId):undefined;
 if(context.attemptId&&!attempt)return unavailable('Attempt');
 const task=context.taskId?snapshot.tasks.find(t=>t.id===context.taskId):undefined;
 const worker=Boolean(task&&run&&task.runId===run.id&&run.assignments.some(a=>a.taskId===task.id)&&(!attempt||attempt.taskIds.includes(task.parentTaskId??'')));
 if(context.taskId&&(!task||task.projectId!==context.projectId||!worker&&(attempt&&!attempt.taskIds.includes(context.taskId)||mission&&!mission.taskIds.includes(context.taskId))))return unavailable('Task');
 return {context};
}
export function sameResultRef(a:MissionResultRef|undefined,b:MissionResultRef|undefined):boolean {
 if(!a||!b||a.kind!==b.kind||a.sha256!==b.sha256)return false;
 return a.kind==='reply'&&b.kind==='reply'?a.taskId===b.taskId&&a.messageId===b.messageId:a.kind!=='reply'&&b.kind!=='reply'&&a.artifactId===b.artifactId;
}
export function storageOutcomeUncertain(snapshot:Snapshot):boolean {return snapshot.persistence?.uncertain===true||['uncertain','unsaved'].includes(snapshot.persistence?.state);}
export function resultStatusKey(snapshot:Snapshot,mission:Mission):string {
 const result=mission.selectedResult,producer=snapshot.tasks.find(t=>t.id===result?.producerTaskId);
 return JSON.stringify([snapshot.epoch,mission.projectId,mission.id,mission.revision,mission.activeAttemptId,mission.acceptancePending,storageOutcomeUncertain(snapshot),result?.id,result?.attemptId,result?.producerTaskId,result?.ref,producer?.transcriptRevision,producer?.status,...(result?.ref.kind==='playable'?[snapshot.runs?.find(r=>r.id===mission.runId)?.revision]:[])]);
}
export function boundResultStatus(snapshot:Snapshot,mission:Mission):MissionResultStatus|undefined {
 if(storageOutcomeUncertain(snapshot))return;
 const entry=snapshot.resultStatuses?.[mission.id],result=mission.selectedResult,status=entry?.status;
 if(result?.ref.kind==='playable'&&status?.runRevision!==snapshot.runs?.find(r=>r.id===mission.runId)?.revision)return;
 if(!result||entry?.state!=='ready'||entry.key!==resultStatusKey(snapshot,mission)||!status||mission.acceptancePending&&status.available||status.epoch!==snapshot.epoch||status.missionId!==mission.id||status.revision!==mission.revision||status.attemptId!==mission.activeAttemptId||status.resultId!==result.id||status.producerTaskId!==result.producerTaskId||!sameResultRef(status.ref,result.ref))return;
 return status;
}
export async function resolveReplyDisplay(ref:Extract<MissionResultRef,{kind:'reply'}>,status:MissionResultStatus|undefined):Promise<{text?:string;unavailable?:string}>{
 if(!status||!status.available)return {unavailable:status?.unavailable??'Selected reply unavailable. Inspect the original task.'};
 if(!sameResultRef(ref,status.ref))return {unavailable:'Selected reply changed. Review and select its current content again.'};
 return {text:status.preview??''};
}

export function workspaceReturnTarget(context:WorkContext|null,selection:{projectId:string;runId?:string;attemptId?:string;missionId?:string;taskId?:string},view:string,embedded:boolean):WorkContext['returnTo']{
 const sameProject=context?.projectId===selection.projectId;
 const sameMission=embedded&&Boolean(selection.missionId&&context?.missionId===selection.missionId);
 const sameEmbeddedConversation=embedded&&!selection.missionId&&!context?.missionId&&Boolean(selection.taskId&&context?.taskId===selection.taskId);
 if(context&&sameProject&&(sameMission||sameEmbeddedConversation))return context.returnTo;
 return {view,projectId:selection.projectId,...(selection.runId?{runId:selection.runId}:{}),...(selection.attemptId?{attemptId:selection.attemptId}:{}),...(selection.missionId?{missionId:selection.missionId}:{})};
}
