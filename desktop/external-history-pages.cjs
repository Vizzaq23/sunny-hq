const {randomUUID}=require('node:crypto');
const {readTranscriptPage,DEFAULT_PAGE_LIMIT,MAX_PAGE_LIMIT}=require('./transcript-pages.cjs');
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const id=value=>typeof value==='string'&&value.length>0&&value.length<=512;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
function shape(value,keys){if(!plain(value)||Object.keys(value).some(key=>!keys.includes(key)))throw Error('Invalid external history request or cursor.');}
function validateExternalPageRequest(request){
 shape(request,['threadId','direction','limit','sessionId','revision','cursor']);
 if(!id(request.threadId)||(request.direction!==undefined&&!['older','newer'].includes(request.direction)))throw Error('Invalid external history request.');
 const limit=request.limit===undefined?DEFAULT_PAGE_LIMIT:request.limit;
 if(!integer(limit)||limit<1||limit>MAX_PAGE_LIMIT)throw Error('External history page limit must be between 1 and 100.');
 if(request.sessionId!==undefined){if(!id(request.sessionId)||request.revision!==1)throw Error('Invalid external history session.');}
 else if(request.revision!==undefined||request.cursor!==undefined)throw Error('External history cursor requires a session.');
 if(request.cursor!==undefined){const c=request.cursor;shape(c,['threadId','sessionId','revision','messageId','offset']);if(!id(c.threadId)||!id(c.sessionId)||!id(c.messageId)||c.revision!==1||!integer(c.offset)||c.threadId!==request.threadId||c.sessionId!==request.sessionId)throw Error('Invalid external history cursor.');}
 return limit;
}
const UNSUPPORTED_CONTENT='[Unsupported content omitted from read-only history.]';
const TEXT_BLOCK_TYPES=new Set(['text','input_text','output_text']);
function messageText(value){
 if(typeof value==='string')return value;
 if(Array.isArray(value))return value.map(messageText).filter(Boolean).join('\n');
 if(plain(value)){
  if(value.type!==undefined&&!TEXT_BLOCK_TYPES.has(value.type))return UNSUPPORTED_CONTENT;
  for(const key of ['text','content','input'])if(Object.hasOwn(value,key))return messageText(value[key]);
  return UNSUPPORTED_CONTENT;
 }
 return value==null?'':UNSUPPORTED_CONTENT;
}
function body(item,keys){
 if(typeof item==='string')return item;
 if(!plain(item))return UNSUPPORTED_CONTENT;
 for(const key of keys)if(Object.hasOwn(item,key))return item[key];
 return UNSUPPORTED_CONTENT;
}
function displayItem(item){
 if(typeof item==='string')return {role:'system',value:item};
 if(plain(item)){
  if(item.type===undefined&&Object.hasOwn(item,'userMessage'))return {role:'user',value:body(item.userMessage,['input','text','content'])};
  if(item.type===undefined&&Object.hasOwn(item,'agentMessage'))return {role:'assistant',value:body(item.agentMessage,['text','content'])};
  if(item.type==='userMessage')return {role:'user',value:body(item,['input','text','content'])};
  if(item.type==='agentMessage')return {role:'assistant',value:body(item,['text','content'])};
  if(item.type===undefined&&(['user','assistant','system'].includes(item.role)||(item.role===undefined&&Object.hasOwn(item,'text'))))return {role:item.role??'system',value:body(item,['text','content','input'])};
 }
 return {role:'system',value:UNSUPPORTED_CONTENT};
}
// Keep source text by reference. Only index metadata and one lazily normalized message
// are retained; do not clone/encode/hash the full provider history for paging.
function displayMessages(detail){
 const recognized=Array.isArray(detail)||Array.isArray(detail?.messages)||Array.isArray(detail?.thread?.turns)||Array.isArray(detail?.turns);
 const source=Array.isArray(detail)?detail:Array.isArray(detail?.messages)?detail.messages:Array.isArray(detail?.thread?.turns)?detail.thread.turns:Array.isArray(detail?.turns)?detail.turns:[];
 const flatten=!Array.isArray(detail)&&!Array.isArray(detail?.messages)&&(Array.isArray(detail?.thread?.turns)||Array.isArray(detail?.turns));
 const indices=[];
 for(let i=0;i<source.length;i++){
  const items=flatten&&Array.isArray(source[i]?.items)?source[i].items:null;
  if(items){for(let j=0;j<items.length;j++)if(displayItem(items[j]))indices.push([i,j]);}
  else if(displayItem(source[i]))indices.push([i]);
 }
 let cachedIndex=-1,cachedMessage;
 const get=index=>{
  if(index===cachedIndex)return cachedMessage;
  if(index<0||index>=indices.length)return undefined;
  const [i,j]=indices[index],display=displayItem(j===undefined?source[i]:source[i].items[j]);
  cachedIndex=index;cachedMessage={id:String(index),role:display.role,time:0,text:messageText(display.value)};return cachedMessage;
 };
 if(!indices.length)return recognized?[]:[{id:'0',role:'system',time:0,text:typeof detail==='string'?detail:UNSUPPORTED_CONTENT}];
 return new Proxy(new Array(indices.length),{get(target,key){if(key==='findIndex')return predicate=>{for(let i=0;i<indices.length;i++)if(predicate({id:String(i)}))return i;return -1;};if(typeof key==='string'&&/^\d+$/.test(key))return get(Number(key));return Reflect.get(target,key);}});
}
function createExternalHistoryPager(){
 let cache=null,generation=0;
 return {async readExternalPage(request,{loadHistory}){
  const limit=validateExternalPageRequest(request),threadId=request.threadId;
  if(request.sessionId===undefined){
   const ticket=++generation;cache=null;
   const history=await loadHistory(threadId);
   if(ticket!==generation)return {threadId,stale:true};
   cache={threadId,sessionId:randomUUID(),history,messages:displayMessages(history)};
  }
  if(!cache||cache.threadId!==threadId||(request.sessionId!==undefined&&request.sessionId!==cache.sessionId))return {threadId,stale:true};
  const sessionId=cache.sessionId,revision=1,c=request.cursor;
  const page=readTranscriptPage({epoch:sessionId,revision,task:{id:threadId,projectId:'external',messages:cache.messages}},{projectId:'external',taskId:threadId,epoch:sessionId,revision,direction:request.direction??'older',limit,...(c?{cursor:{epoch:c.sessionId,taskId:c.threadId,revision:c.revision,messageId:c.messageId,offset:c.offset}}:{})});
  const cursor=value=>({threadId,sessionId,revision,messageId:value.messageId,offset:value.offset});
  return {threadId,sessionId,revision,segments:page.segments,complete:page.complete,...(page.previousCursor?{previousCursor:cursor(page.previousCursor)}:{}),...(page.nextCursor?{nextCursor:cursor(page.nextCursor)}:{})};
 }};
}
module.exports={createExternalHistoryPager,validateExternalPageRequest};
