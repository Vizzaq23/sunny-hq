import type {Mission,MissionResultRef,MissionResultStatus,Snapshot,WorkContext} from './shared';
export function resolveWorkContext(context:WorkContext|null,snapshot:Snapshot):{context:WorkContext|null;unavailable?:string}{
 if(!context)return {context:null};
 const unavailable=(item:string)=>({context,unavailable:`${item} unavailable. Your saved selection is retained.`});
 if(!snapshot.projects.some(p=>p.id===context.projectId))return unavailable('Project');
 const mission=context.missionId?(snapshot.missions??[]).find(m=>m.id===context.missionId):undefined;
 if(context.missionId&&(!mission||mission.projectId!==context.projectId))return unavailable('Mission');
 const attempt=context.attemptId?mission?.attempts.find(a=>a.id===context.attemptId):undefined;
 if(context.attemptId&&!attempt)return unavailable('Attempt');
 const task=context.taskId?snapshot.tasks.find(t=>t.id===context.taskId):undefined;
 if(context.taskId&&(!task||task.projectId!==context.projectId||attempt&&!attempt.taskIds.includes(context.taskId)||mission&&!mission.taskIds.includes(context.taskId)))return unavailable('Task');
 return {context};
}
export function sameResultRef(a:MissionResultRef|undefined,b:MissionResultRef|undefined):boolean {
 if(!a||!b||a.kind!==b.kind||a.sha256!==b.sha256)return false;
 return a.kind==='reply'&&b.kind==='reply'?a.taskId===b.taskId&&a.messageId===b.messageId:a.kind==='deliverable'&&b.kind==='deliverable'&&a.artifactId===b.artifactId;
}
export function storageOutcomeUncertain(snapshot:Snapshot):boolean {return snapshot.persistence?.uncertain===true||snapshot.persistence?.state==='uncertain';}
export function resultStatusKey(snapshot:Snapshot,mission:Mission):string {
 const result=mission.selectedResult,producer=snapshot.tasks.find(t=>t.id===result?.producerTaskId);
 return JSON.stringify([snapshot.epoch,mission.projectId,mission.id,mission.revision,mission.activeAttemptId,mission.acceptancePending,storageOutcomeUncertain(snapshot),result?.id,result?.attemptId,result?.producerTaskId,result?.ref,producer?.transcriptRevision,producer?.status]);
}
export function boundResultStatus(snapshot:Snapshot,mission:Mission):MissionResultStatus|undefined {
 if(storageOutcomeUncertain(snapshot))return;
 const entry=snapshot.resultStatuses?.[mission.id],result=mission.selectedResult,status=entry?.status;
 if(!result||entry?.state!=='ready'||entry.key!==resultStatusKey(snapshot,mission)||!status||mission.acceptancePending&&status.available||status.epoch!==snapshot.epoch||status.missionId!==mission.id||status.revision!==mission.revision||status.attemptId!==mission.activeAttemptId||status.resultId!==result.id||status.producerTaskId!==result.producerTaskId||!sameResultRef(status.ref,result.ref))return;
 return status;
}
export async function resolveReplyDisplay(ref:Extract<MissionResultRef,{kind:'reply'}>,status:MissionResultStatus|undefined):Promise<{text?:string;unavailable?:string}>{
 if(!status||!status.available)return {unavailable:status?.unavailable??'Selected reply unavailable. Inspect the original task.'};
 if(!sameResultRef(ref,status.ref))return {unavailable:'Selected reply changed. Review and select its current content again.'};
 return {text:status.preview??''};
}

export function workspaceReturnTarget(context:WorkContext|null,selection:{projectId:string;missionId?:string;taskId?:string},view:string,embedded:boolean):WorkContext['returnTo']{
 const sameProject=context?.projectId===selection.projectId;
 const sameMission=Boolean(selection.missionId&&context?.missionId===selection.missionId);
 const sameEmbeddedConversation=embedded&&!selection.missionId&&!context?.missionId&&Boolean(selection.taskId&&context?.taskId===selection.taskId);
 if(context&&sameProject&&(sameMission||sameEmbeddedConversation))return context.returnTo;
 return {view,projectId:selection.projectId,...(selection.missionId?{missionId:selection.missionId}:{})};
}
