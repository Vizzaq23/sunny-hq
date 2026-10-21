// Renderer pages are display data. They never prove result identity or acceptance.
export interface TranscriptSelection {projectId:string;taskId:string;epoch:string;revision:number;}
export interface TranscriptCursor {epoch:string;taskId:string;revision:number;messageId:string;offset:number;}
export interface TranscriptSegment {messageId:string;role:'user'|'assistant'|'system';time:number;offset:number;text:string;totalLength:number;replyRef?:{kind:'reply';taskId:string;messageId:string;sha256:string};}
export interface TranscriptPage {epoch:string;taskId:string;revision:number;segments:TranscriptSegment[];nextCursor?:TranscriptCursor;previousCursor?:TranscriptCursor;complete:boolean;}
export interface StaleTranscriptPage {stale:true;epoch:string;taskId:string;revision:number;summary?:{transcriptRevision:number};}
export interface TranscriptRequest {id:number;selection:TranscriptSelection;direction:'older'|'newer';cursor?:TranscriptCursor;}
export interface TranscriptDelta {epoch:string;sequence:number;taskId?:string;baseRevision?:number;revision?:number;kind?:'appendMessage'|'appendText'|'invalidate';messageId?:string;offset?:number;text?:string;role?:TranscriptSegment['role'];time?:number;type?:string;}
export interface TranscriptState {selection:TranscriptSelection|null;sequence:number;pages:TranscriptPage[];pending:TranscriptRequest|null;loading:boolean;error:string;needsReload:boolean;}
export type TranscriptAction={type:'select';selection:TranscriptSelection|null;sequence?:number}|{type:'request';request:TranscriptRequest}|{type:'page';request:TranscriptRequest;page:TranscriptPage|StaleTranscriptPage}|{type:'failure';request:TranscriptRequest;error:string}|{type:'event';event:TranscriptDelta};
export const MAX_CACHED_PAGES=3;
export function createTranscriptState():TranscriptState {return {selection:null,sequence:0,pages:[],pending:null,loading:false,error:'',needsReload:false};}
export function sameSelection(a:TranscriptSelection|null,b:TranscriptSelection|null):boolean {return a===b||Boolean(a&&b&&a.projectId===b.projectId&&a.taskId===b.taskId&&a.epoch===b.epoch&&a.revision===b.revision);}
function invalidate(state:TranscriptState,revision=state.selection?.revision):TranscriptState {return {...state,selection:state.selection&&revision!==undefined?{...state.selection,revision}:state.selection,pages:[],pending:null,loading:false,error:'History changed; reload the current transcript.',needsReload:true};}
function matchesRequest(state:TranscriptState,request:TranscriptRequest):boolean {return state.pending?.id===request.id&&sameSelection(state.selection,request.selection);}
function advanceCursor(cursor:TranscriptCursor|undefined,revision:number):TranscriptCursor|undefined {return cursor?{...cursor,revision}:undefined;}
function validTextBoundary(a:string,b:string):boolean {return !(/[\ud800-\udbff]$/.test(a)&&/^[\udc00-\udfff]/.test(b));}
function pageBytes(page:TranscriptPage):number {return page.segments.reduce((n,s)=>n+new TextEncoder().encode(s.text).length,0);}
export function transcriptReducer(state:TranscriptState,action:TranscriptAction):TranscriptState {
 if(action.type==='select'){
  if(sameSelection(state.selection,action.selection))return state;
  return {...createTranscriptState(),selection:action.selection,sequence:action.sequence??state.sequence,needsReload:Boolean(action.selection)};
 }
 if(action.type==='request')return sameSelection(state.selection,action.request.selection)?{...state,pending:action.request,loading:true,error:'',needsReload:false}:state;
 if(action.type==='failure')return matchesRequest(state,action.request)?{...state,pending:null,loading:false,error:action.error}:state;
 if(action.type==='page'){
  if(!matchesRequest(state,action.request))return state;
  const page=action.page;
  if('stale' in page){
   if(page.epoch!==state.selection?.epoch)return {...invalidate(state),needsReload:false,error:'Transcript session changed; refresh Sunny and retry.'};
   if(page.revision===state.selection.revision)return {...invalidate(state),needsReload:false,error:'History unavailable; refresh Sunny and retry.'};
   return invalidate(state,page.revision);
  }
  if(page.epoch!==state.selection?.epoch||page.taskId!==state.selection.taskId||page.revision!==state.selection.revision)return invalidate(state);
  // Evict farthest pages in the opposite direction; never grow with history size.
  const pages=action.request.direction==='older'?[page,...state.pages]:[...state.pages,page];
  const bounded=pages.length>MAX_CACHED_PAGES?(action.request.direction==='older'?pages.slice(0,MAX_CACHED_PAGES):pages.slice(-MAX_CACHED_PAGES)):pages;
  return {...state,pages:bounded,pending:null,loading:false,error:'',needsReload:false};
 }
 const event=action.event;
 if(!state.selection||event.epoch!==state.selection.epoch||event.sequence<=state.sequence)return state;
 const next={...state,sequence:event.sequence};
 if(event.sequence!==state.sequence+1)return invalidate(next,event.taskId===state.selection.taskId?event.revision:undefined);
 if(event.taskId!==state.selection.taskId||!event.kind)return next;
 if(event.baseRevision!==state.selection.revision||event.revision!==state.selection.revision+1||event.kind==='invalidate')return invalidate(next,event.revision);
 const revision=event.revision;
 if(typeof event.text!=='string'||!event.messageId||new TextEncoder().encode(event.text).length>256*1024)return invalidate(next,revision);
 let pages=state.pages.map(page=>({...page,revision,nextCursor:advanceCursor(page.nextCursor,revision),previousCursor:advanceCursor(page.previousCursor,revision),segments:page.segments.map(s=>({...s}))}));
 if(event.kind==='appendText'){
  if(event.offset===undefined||!Number.isSafeInteger(event.offset)||event.offset<0)return invalidate(next,revision);
  for(const page of pages)for(const s of page.segments)if(s.messageId===event.messageId){
   delete s.replyRef; // A hash of older complete content cannot describe the appended reply.
   if(s.totalLength!==event.offset)return invalidate(next,revision);
   if(s.offset+s.text.length===event.offset){
    if(!validTextBoundary(s.text,event.text))return invalidate(next,revision);
    if(pageBytes(page)+new TextEncoder().encode(event.text).length<=256*1024)s.text+=event.text;
    else page.nextCursor={epoch:event.epoch,taskId:state.selection.taskId,revision,messageId:s.messageId,offset:event.offset};
   }
   s.totalLength=event.offset!+event.text.length;
  }
 }else{
  if(!event.role||typeof event.time!=='number'||pages.some(p=>p.segments.some(s=>s.messageId===event.messageId)))return invalidate(next,revision);
  const tail=pages.at(-1);
  if(tail&&!tail.nextCursor){
   if(tail.segments.length<100&&pageBytes(tail)+new TextEncoder().encode(event.text).length<=256*1024)tail.segments.push({messageId:event.messageId,role:event.role,time:event.time,offset:0,text:event.text,totalLength:event.text.length});
   else {const last=tail.segments.at(-1);if(last)tail.nextCursor={epoch:event.epoch,taskId:state.selection.taskId,revision,messageId:last.messageId,offset:last.offset+last.text.length};}
  }
 }
 // Overflow stays unread behind a current cursor; older readable pages remain bounded.
 if(pages.some(p=>p.segments.length>100||pageBytes(p)>256*1024))return invalidate(next,revision);
 return {...next,selection:{...state.selection,revision},pages,pending:null,loading:false,needsReload:pages.length===0,error:''};
}
export function transcriptSegments(state:TranscriptState):TranscriptSegment[] {
 const result:TranscriptSegment[]=[],seen=new Set<string>();
 for(const page of state.pages)for(const segment of page.segments){const key=JSON.stringify([segment.messageId,segment.offset]);if(!seen.has(key)){seen.add(key);result.push(segment);}}
 // A message may be split across adjacent pages fetched in either direction.
 const order=new Map<string,number>();for(const segment of result)if(!order.has(segment.messageId))order.set(segment.messageId,order.size);
 return result.sort((a,b)=>order.get(a.messageId)!-order.get(b.messageId)!||a.offset-b.offset);
}

export interface PublicSnapshot {epoch:string;sequence:number;taskSummaries:Array<{id:string;transcriptRevision:number;[key:string]:unknown}>;[key:string]:unknown;}
export interface PublicEvent {epoch:string;sequence:number;type:string;data:any;}
export interface PublicState {snapshot:PublicSnapshot;needsSnapshot:boolean;earlyEvents?:PublicEvent[];retiredEpochs?:string[];}
export type PublicAction={type:'snapshot';snapshot:PublicSnapshot}|{type:'event';event:PublicEvent};
export function publicStateReducer(state:PublicState|null,action:PublicAction):PublicState|null {
 if(action.type==='snapshot'){
  if(state?.retiredEpochs?.includes(action.snapshot.epoch))return state;
  if(state?.earlyEvents){
   let next:PublicState|null={snapshot:action.snapshot,needsSnapshot:state.needsSnapshot,retiredEpochs:state.snapshot.epoch!==action.snapshot.epoch?[...(state.retiredEpochs??[]),state.snapshot.epoch]:state.retiredEpochs};
   for(const event of state.earlyEvents)if(event.epoch===action.snapshot.epoch&&event.sequence>action.snapshot.sequence)next=publicStateReducer(next,{type:'event',event});
   return next;
  }
  if(state&&state.snapshot.epoch===action.snapshot.epoch&&action.snapshot.sequence<state.snapshot.sequence)return state;
  return {snapshot:action.snapshot,needsSnapshot:false,retiredEpochs:state&&state.snapshot.epoch!==action.snapshot.epoch?[...(state.retiredEpochs??[]),state.snapshot.epoch]:state?.retiredEpochs};
 }
 const e=action.event;
 if(e.type==='snapshot')return publicStateReducer(state,{type:'snapshot',snapshot:e.data});
 if(!state)state={snapshot:{epoch:e.epoch,sequence:e.sequence-1,taskSummaries:[]},needsSnapshot:false,earlyEvents:[]};
 if(e.epoch!==state.snapshot.epoch||e.sequence<=state.snapshot.sequence)return state;
 let snapshot:PublicSnapshot={...state.snapshot,sequence:e.sequence};
 if(e.type==='task'){
  const existing=snapshot.taskSummaries.find(t=>t.id===e.data.id);
  if(!existing||e.data.transcriptRevision>=existing.transcriptRevision)snapshot.taskSummaries=[e.data,...snapshot.taskSummaries.filter(t=>t.id!==e.data.id)];
 }else if(e.type==='transcript:delta')snapshot.taskSummaries=snapshot.taskSummaries.map(t=>t.id===e.data.taskId&&e.data.revision>t.transcriptRevision?{...t,transcriptRevision:e.data.revision}:t);
 else if(e.type==='persistence')snapshot.persistence=e.data;
 else if(e.type==='approval')snapshot.approvals=[...(Array.isArray(snapshot.approvals)?snapshot.approvals:[]).filter(a=>a.id!==e.data.id),e.data];
 const earlyEvents=state.earlyEvents?[...state.earlyEvents,e].slice(-256):undefined;
 return {...state,snapshot,earlyEvents,needsSnapshot:state.needsSnapshot||e.sequence!==state.snapshot.sequence+1||Boolean(state.earlyEvents&&state.earlyEvents.length>=256)};
}
