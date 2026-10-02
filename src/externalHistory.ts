export type ExternalCursor={threadId:string;sessionId:string;revision:1;messageId:string;offset:number};
export type ExternalSegment={messageId:string;role:'user'|'assistant'|'system';time:number;offset:number;text:string;totalLength:number};
export type ExternalPage={threadId:string;sessionId:string;revision:1;segments:ExternalSegment[];complete:boolean;previousCursor?:ExternalCursor;nextCursor?:ExternalCursor};
export type ExternalHistoryState={summary:any;page:ExternalPage|null;loading:boolean;error:string};
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
// Each selection/request owns a ticket. Closing/unmounting or selecting another
// history invalidates its pending reply before any renderer state can be published.
export function createExternalHistoryController(invoke:Invoke,publish:(state:ExternalHistoryState|null)=>void){
 let state:ExternalHistoryState|null=null,ticket=0;
 const update=(next:ExternalHistoryState|null)=>{state=next;publish(next);};
 const read=async(summary:any,direction:'older'|'newer',page:ExternalPage|null,cursor?:ExternalCursor)=>{
  const current=++ticket,threadId=summary.threadId??summary.id;
  update({summary,page,loading:true,error:''});
  try{
   const result=await invoke<ExternalPage|{threadId:string;stale:true}>('task:readExternalPage',{threadId,direction,...(page?{sessionId:page.sessionId,revision:page.revision,...(cursor?{cursor}:{})}:{})});
   if(current!==ticket)return;
   if('stale' in result||result.threadId!==threadId||(page&&result.sessionId!==page.sessionId))throw Error('History changed. Reload history to reopen it.');
   update({summary,page:result,loading:false,error:''});
  }catch(error){if(current===ticket)update({summary,page,loading:false,error:error instanceof Error?error.message:'Unable to read history. Reload history to try again.'});}
 };
 return {
  open:(summary:any)=>read(summary,'older',null),
  load:(direction:'older'|'newer')=>{if(!state||state.loading||!state.page)return Promise.resolve();const cursor=direction==='older'?state.page.previousCursor:state.page.nextCursor;return cursor?read(state.summary,direction,state.page,cursor):Promise.resolve();},
  reload:()=>state?read(state.summary,'older',null):Promise.resolve(),
  close:()=>{ticket++;update(null);}
 };
}
