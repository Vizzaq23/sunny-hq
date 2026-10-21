const {TextDecoder}=require('node:util');
const admitted=new WeakMap(),MAX_ARCHIVE_BYTES=256*1024*1024;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const failure=code=>Object.assign(Error(code),{code});
const localId=value=>typeof value==='string'&&value.startsWith('chatgpt:')&&value.length>8&&value.length<=200&&!value.includes('\0');
function freezeDocument(value){
 const pending=[value];while(pending.length){const item=pending.pop();if(item&&typeof item==='object'){for(const child of Object.values(item))if(child&&typeof child==='object')pending.push(child);Object.freeze(item);}}return value;
}
function decodeArchive(bytes){
 if(!Buffer.isBuffer(bytes))throw failure('ARCHIVE_INVALID');
 if(bytes.length>MAX_ARCHIVE_BYTES)throw failure('ARCHIVE_LIMIT');
 const raw=Buffer.from(bytes);let value;
 try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw));}catch{throw failure('ARCHIVE_INVALID');}
 if(!Array.isArray(value))throw failure('ARCHIVE_UNSUPPORTED');
 const ids=new Set();
 for(const item of value){
  if(!plain(item)||!localId(item.id)||ids.has(item.id)||typeof item.title!=='string'||typeof item.projectName!=='string'||item.external!==true||typeof item.status!=='string'||!Array.isArray(item.messages))throw failure('ARCHIVE_UNSUPPORTED');
  ids.add(item.id);
  for(const message of item.messages)if(!plain(message)||typeof message.id!=='string'||!['user','assistant','system'].includes(message.role)||typeof message.text!=='string')throw failure('ARCHIVE_UNSUPPORTED');
 }
 freezeDocument(value);
 const archive=Object.freeze({get raw(){return Buffer.from(raw);},value});admitted.set(archive,value);return archive;
}
// These two pure functions are also the ordinary application's local branch.
// No provider or filesystem fallback belongs in the local consumer.
function localHistoryIndex(document){return document.map(({messages,...summary})=>summary);}
function localHistoryItem(document,id){const item=document.find(item=>item.id===id);if(!item)throw failure('LOCAL_HISTORY_NOT_FOUND');return {messages:item.messages};}
function createLocalHistory(archive){
 const document=admitted.get(archive);if(!document)throw failure('ARCHIVE_ADMISSION_REQUIRED');
 const pager=require('./external-history-pages.cjs').createExternalHistoryPager();
 const history=id=>{if(!localId(id))throw failure('LOCAL_HISTORY_NOT_FOUND');return localHistoryItem(document,id);};
 const index=()=>localHistoryIndex(document).map(({id,title,projectName,external,status})=>({id,title,projectName,external,status}));
 return Object.freeze({index,history,async page(request){require('./external-history-pages.cjs').validateExternalPageRequest(request);history(request.threadId);return pager.readExternalPage(request,{loadHistory:history});}});
}
module.exports={decodeArchive,createLocalHistory,localHistoryIndex,localHistoryItem};
