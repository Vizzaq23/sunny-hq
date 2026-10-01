import type {MissionResultRef,Snapshot,Task,WorkContext} from './shared';
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
export async function resolveReplyDisplay(ref:Extract<MissionResultRef,{kind:'reply'}>,task:Task|undefined):Promise<{text?:string;unavailable?:string}>{
 const matches=task?.messages.filter(m=>m.id===ref.messageId)??[];
 if(task?.id!==ref.taskId||task.status!=='finished'||matches.length!==1||matches[0].role!=='assistant'||!matches[0].text.trim())return {unavailable:'Selected reply unavailable. Inspect the original task.'};
 const text=matches[0].text,bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 const hash=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
 return hash===ref.sha256?{text}:{unavailable:'Selected reply changed. Review and select its current content again.'};
}

export function workspaceReturnTarget(context:WorkContext|null,selection:{projectId:string;missionId?:string;taskId?:string},view:string,embedded:boolean):WorkContext['returnTo']{
 const sameProject=context?.projectId===selection.projectId;
 const sameMission=Boolean(selection.missionId&&context?.missionId===selection.missionId);
 const sameEmbeddedConversation=embedded&&!selection.missionId&&!context?.missionId&&Boolean(selection.taskId&&context?.taskId===selection.taskId);
 if(context&&sameProject&&(sameMission||sameEmbeddedConversation))return context.returnTo;
 return {view,projectId:selection.projectId,...(selection.missionId?{missionId:selection.missionId}:{})};
}
