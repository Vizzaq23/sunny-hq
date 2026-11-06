import {useEffect,useState} from 'react';
import type {WorkspaceDraft,WorkspaceState,WorkspaceUpdate} from './shared';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
const queues=new WeakMap<Invoke,Promise<unknown>>();
export function updateWorkspace(invoke:Invoke,update:Omit<WorkspaceUpdate,'expectedRevision'>):Promise<WorkspaceState>{
 const previous=queues.get(invoke)??Promise.resolve();
 const next=previous.catch(()=>{}).then(async()=>{const current=await invoke<WorkspaceState>('workspace:get',{});return invoke<WorkspaceState>('workspace:update',{expectedRevision:current.revision,...update});});
 queues.set(invoke,next);return next;
}
export const saveWorkspaceDraft=(invoke:Invoke,draft:WorkspaceDraft)=>updateWorkspace(invoke,{draft:{...draft,updatedAt:Date.now()}});
export const deleteWorkspaceDraft=(invoke:Invoke,id:string,expectedDraftRevision:number)=>updateWorkspace(invoke,{deleteDraft:{id,expectedDraftRevision}});
export function sameSubmittedDraft(current:WorkspaceDraft,submitted:WorkspaceDraft){return current.id===submitted.id&&current.revision===submitted.revision&&current.text===submitted.text&&current.title===submitted.title&&current.completionBoundary===submitted.completionBoundary&&JSON.stringify(current.criteria)===JSON.stringify(submitted.criteria);}
type DraftEntry={draft:WorkspaceDraft;dirty:boolean;error:string;saving:boolean;generation:number;listeners:Set<()=>void>;pending?:Promise<WorkspaceDraft>};
const draftCache=new Map<string,DraftEntry>();
export function exportDraft(draft:WorkspaceDraft){
 const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='sunny-draft.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}
export function useWorkspaceDraft(id:string,seed:Omit<WorkspaceDraft,'id'|'revision'|'updatedAt'>,workspace:WorkspaceState,invoke:Invoke){
 const [,render]=useState(0);
 if(!draftCache.has(id))draftCache.set(id,{draft:workspace.drafts.find(d=>d.id===id)??{...seed,id,revision:0,updatedAt:Date.now()},dirty:false,error:'',saving:false,generation:0,listeners:new Set()});
 const entry=draftCache.get(id)!;
 const notify=()=>entry.listeners.forEach(listener=>listener());
 useEffect(()=>{const listener=()=>render(n=>n+1);entry.listeners.add(listener);return()=>{entry.listeners.delete(listener);};},[entry]);
 useEffect(()=>{const saved=workspace.drafts.find(d=>d.id===id);if(saved&&!entry.dirty&&!entry.saving&&saved.revision!==entry.draft.revision){entry.draft=saved;notify();}},[workspace.revision,id]);
 const edit=(changes:Partial<Pick<WorkspaceDraft,'text'|'title'|'criteria'|'completionBoundary'>>)=>{entry.draft={...entry.draft,...changes};entry.generation++;entry.dirty=true;entry.error='';notify();};
 const save=():Promise<WorkspaceDraft>=>{
  if(entry.pending)return entry.pending;
  if(!entry.dirty)return Promise.resolve({...entry.draft});
  const submitted={...entry.draft},generation=entry.generation;entry.saving=true;notify();
  entry.pending=saveWorkspaceDraft(invoke,submitted).then(state=>{const saved=state.drafts.find(d=>d.id===id);if(!saved)throw Error('Saved draft was unavailable');entry.draft={...entry.draft,revision:saved.revision,updatedAt:saved.updatedAt};if(entry.generation===generation){entry.draft=saved;entry.dirty=false;}entry.error='';return saved;}).catch(error=>{entry.error=error instanceof Error?error.message:String(error);throw error;}).finally(()=>{entry.pending=undefined;entry.saving=false;notify();});
  return entry.pending;
 };
 const flush=async()=>{await save();if(entry.dirty)return save();return {...entry.draft};};
 const clear=async(submitted:WorkspaceDraft)=>{
  await deleteWorkspaceDraft(invoke,id,submitted.revision);
  const unchanged=sameSubmittedDraft(entry.draft,submitted);
  entry.draft=unchanged?{...seed,id,revision:0,updatedAt:Date.now()}:{...entry.draft,revision:0};entry.dirty=!unchanged;entry.error='';entry.generation++;notify();
 };
 const refresh=async()=>{const state=await invoke<WorkspaceState>('workspace:get',{});entry.draft={...entry.draft,revision:state.drafts.find(d=>d.id===id)?.revision??0};entry.error='Saved revision refreshed. Your local edits remain unsaved; choose Save my edits or export.';notify();};
 useEffect(()=>()=>{if(entry.dirty&&!entry.error&&entry.draft.projectId&&window.sunny)void save().catch(()=>{});},[entry]);
 useEffect(()=>{if(!entry.dirty||entry.error||entry.saving||!entry.draft.projectId||!window.sunny)return;const timer=setTimeout(()=>void save().catch(()=>{}),350);return()=>clearTimeout(timer);},[id,entry.generation,entry.saving,entry.error]);
 return {draft:entry.draft,edit,save:flush,clear,refresh,export:()=>exportDraft(entry.draft),dirty:entry.dirty,error:entry.error,saving:entry.saving};
}

export function clearSubmittedDraft(key:string,submitted:string){
 try{const storageKey=`sunny:draft:v1:${key}`;if(sessionStorage.getItem(storageKey)===submitted)sessionStorage.setItem(storageKey,'');}catch{/* A failed storage write must not turn a successful launch into a retry. */}
 window.dispatchEvent(new CustomEvent('sunny:draft-submitted',{detail:{key,submitted}}));
}

// Session-scoped drafts survive navigation and reloads, and clear when the window closes.
export function useDraft(key:string,initial='',options?:{id:string;projectId:string;taskId?:string;workspace:WorkspaceState;invoke:Invoke}){
 const workspaceDraft=useWorkspaceDraft(options?.id??'session:'+key,{kind:'message',projectId:options?.projectId??'',taskId:options?.taskId,text:initial},options?.workspace??{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]},options?.invoke??(async()=>{throw Error('Workspace unavailable');}));
 const read=()=>{try{return sessionStorage.getItem(`sunny:draft:v1:${key}`)??initial;}catch{return initial;}};
 const [stored,setStored]=useState(()=>({key,text:read()}));
 useEffect(()=>{
  const change=(event:Event)=>{if((event as CustomEvent).detail===key)setStored({key,text:read()});};
  const clear=(event:Event)=>{const detail=(event as CustomEvent<{key:string;submitted:string}>).detail;if(detail.key===key)setStored(previous=>previous.key===key&&previous.text===detail.submitted?{key,text:''}:previous);};
  window.addEventListener('sunny:draft-change',change);window.addEventListener('sunny:draft-submitted',clear);
  return()=>{window.removeEventListener('sunny:draft-change',change);window.removeEventListener('sunny:draft-submitted',clear);};
 },[key]);
 let text=stored.text;
 if(stored.key!==key){text=read();setStored({key,text});}
 const setText=(value:string)=>{
  setStored({key,text:value});
  try{sessionStorage.setItem(`sunny:draft:v1:${key}`,value);window.dispatchEvent(new CustomEvent('sunny:draft-change',{detail:key}));}catch{/* The in-memory draft remains usable when storage is unavailable. */}
 };
 return [options?workspaceDraft.draft.text:text,options?(value:string)=>workspaceDraft.edit({text:value}):setText,options?workspaceDraft:undefined] as const;
}

