import {useCallback,useEffect,useRef,useState} from 'react';
import {createTranscriptState,sameSelection,transcriptReducer,transcriptSegments} from './transcriptState';
import type {TranscriptAction,TranscriptCursor,TranscriptDelta,TranscriptPage,TranscriptRequest,TranscriptSelection,StaleTranscriptPage} from './transcriptState';

type Event={type:string;epoch?:string;sequence?:number;data:any};
export interface TaskTranscriptOptions {
 projectId?:string;taskId?:string;epoch?:string;revision?:number;sequence?:number;
 invoke:(action:string,args?:unknown)=>Promise<unknown>;
 subscribe?:(handler:(event:Event)=>void)=>()=>void;
 onStale?:(page:StaleTranscriptPage)=>void;
}
export function useTaskTranscript(options:TaskTranscriptOptions){
 const {projectId,taskId,epoch,revision,sequence=0,invoke,subscribe,onStale}=options;
 const [state,setState]=useState(createTranscriptState);
 const current=useRef(state),requestId=useRef(0),alive=useRef(true);
 const lastRequest=useRef<TranscriptRequest|null>(null);
 const dependencies=useRef({invoke,onStale});dependencies.current={invoke,onStale};
 const send=useCallback((action:TranscriptAction)=>{if(!alive.current)return;const next=transcriptReducer(current.current,action);if(next!==current.current){current.current=next;setState(next);}},[]);
 const requestPage=useCallback((direction:'older'|'newer',cursor?:TranscriptCursor)=>{
  const selection=current.current.selection;if(!selection||current.current.loading)return;
  const request:TranscriptRequest={id:++requestId.current,selection:{...selection},direction,cursor};
  lastRequest.current=request;
  send({type:'request',request});
  void dependencies.current.invoke('transcript:page',{...selection,direction,...(cursor?{cursor}:{} )}).then(value=>{
   const page=value as TranscriptPage|StaleTranscriptPage;
   if('stale' in page&&sameSelection(current.current.selection,request.selection))dependencies.current.onStale?.(page);
   send({type:'page',request,page});
  }).catch(error=>send({type:'failure',request,error:error instanceof Error?error.message:String(error)}));
 },[send]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  const selection:TranscriptSelection|null=projectId&&taskId&&epoch&&revision!==undefined?{projectId,taskId,epoch,revision}:null;
  const existing=current.current.selection;
  // A summary may render before or after its matching delta. Verified local append revisions win.
  if(existing&&selection&&existing.projectId===selection.projectId&&existing.taskId===selection.taskId&&existing.epoch===selection.epoch&&existing.revision>=selection.revision)return;
  send({type:'select',selection,sequence});
  if(selection)requestPage('older');
 },[projectId,taskId,epoch,revision,send,requestPage]);
 useEffect(()=>{
  if(!subscribe)return;
  return subscribe(event=>{
   const data=event.type==='transcript:delta'?event.data:{};
   const eventEpoch=event.epoch??data.epoch,eventSequence=event.sequence??data.sequence;
   if(typeof eventEpoch!=='string'||typeof eventSequence!=='number')return;
   send({type:'event',event:{...data,type:event.type,epoch:eventEpoch,sequence:eventSequence} as TranscriptDelta});
  });
 },[subscribe,send]);
 useEffect(()=>{if(state.needsReload&&!state.loading)requestPage('older');},[state.needsReload,state.loading,requestPage]);
 const loadOlder=useCallback(()=>{const cursor=current.current.pages[0]?.previousCursor;if(cursor)requestPage('older',cursor);},[requestPage]);
 const loadNewer=useCallback(()=>{const cursor=current.current.pages.at(-1)?.nextCursor;if(cursor)requestPage('newer',cursor);},[requestPage]);
 const retry=useCallback(()=>{const last=lastRequest.current;if(last&&sameSelection(last.selection,current.current.selection))requestPage(last.direction,last.cursor);else requestPage('older');},[requestPage]);
 // Hide a previous selection immediately, before React runs the selection effect.
 const selected=state.selection;
 const matching=selected&&selected.projectId===projectId&&selected.taskId===taskId&&selected.epoch===epoch&&selected.revision>=(revision??0);
 return {segments:matching?transcriptSegments(state):[],loading:matching?state.loading:Boolean(taskId),error:matching?state.error:'',loadOlder,loadNewer,retry,
  hasOlder:Boolean(matching&&state.pages[0]?.previousCursor),hasNewer:Boolean(matching&&state.pages.at(-1)?.nextCursor),revision:selected?.revision};
}
