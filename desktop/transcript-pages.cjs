const DEFAULT_PAGE_LIMIT=50;
const MAX_PAGE_LIMIT=100;
const MAX_TEXT_BYTES=256*1024;

function plainObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));}
function identifier(value){return typeof value==='string'&&value.length>0&&value.length<=512;}
function integer(value){return Number.isSafeInteger(value)&&value>=0;}
function boundary(text,offset){return integer(offset)&&offset<=text.length&&!(offset>0&&offset<text.length&&high(text.charCodeAt(offset-1))&&low(text.charCodeAt(offset)));}
function high(code){return code>=0xd800&&code<=0xdbff;}
function low(code){return code>=0xdc00&&code<=0xdfff;}
function shape(value,keys,label){if(!plainObject(value)||Object.keys(value).some(key=>!keys.includes(key)))throw Error('Invalid '+label+'.');}
function validateMessageMetadata(message){
 if(!['user','assistant','system'].includes(message?.role)||typeof message.time!=='number'||!Number.isFinite(message.time))throw Error('Invalid transcript message metadata.');
}
function validatePageRequest(request){
 shape(request,['projectId','taskId','epoch','revision','cursor','direction','limit'],'transcript page request');
 if(!identifier(request.projectId)||!identifier(request.taskId)||!identifier(request.epoch)||!integer(request.revision)||!['older','newer'].includes(request.direction))throw Error('Invalid transcript page request.');
 const limit=request.limit===undefined?DEFAULT_PAGE_LIMIT:request.limit;
 if(!integer(limit)||limit<1||limit>MAX_PAGE_LIMIT)throw Error('Transcript page limit must be between 1 and 100.');
 if(request.cursor!==undefined){
  const c=request.cursor;shape(c,['epoch','taskId','revision','messageId','offset'],'transcript cursor');
  if(!identifier(c.epoch)||!identifier(c.taskId)||!identifier(c.messageId)||!integer(c.revision)||!integer(c.offset)||c.taskId!==request.taskId)throw Error('Invalid transcript cursor.');
 }
 return limit;
}

// Scan only the response-sized portion. Never encode a giant message just to size a page.
function boundedSlice(text,offset,bytes,direction){
 let edge=offset,used=0;
 while(direction==='newer'?edge<text.length:edge>0){
  const start=direction==='newer'?edge:(edge>=2&&low(text.charCodeAt(edge-1))&&high(text.charCodeAt(edge-2))?edge-2:edge-1);
  const code=text.charCodeAt(start),width=high(code)&&low(text.charCodeAt(start+1))?2:1;
  const size=width===2?4:code<=0x7f?1:code<=0x7ff?2:3;
  if(used+size>bytes)break;
  used+=size;edge=direction==='newer'?edge+width:start;
 }
 const start=direction==='newer'?offset:edge,end=direction==='newer'?edge:offset;
 return {offset:start,text:text.slice(start,end),bytes:used,end};
}

// Trusted caller supplies the task and its current revision AFTER membership validation.
// This function cannot validate an Electron sender or main frame and grants no result authority.
function readTranscriptPage({epoch,task,revision},request){
 const limit=validatePageRequest(request);
 if(task?.id!==request.taskId||task?.projectId!==request.projectId)throw Error('Transcript task/project membership mismatch.');
 const result={epoch,taskId:task.id,revision};
 const c=request.cursor;
 if(request.epoch!==epoch||request.revision!==revision||(c&&(c.epoch!==epoch||c.revision!==revision)))return {...result,stale:true};
 const messages=task.messages;
 if(!Array.isArray(messages))throw Error('Invalid task transcript.');
 if(!messages.length){if(c)throw Error('Transcript cursor refers to a deleted message.');return {...result,segments:[],complete:true};}
 let index=c?messages.findIndex(m=>m.id===c.messageId):request.direction==='older'?messages.length-1:0;
 if(index<0)throw Error('Transcript cursor refers to a deleted message.');
 let offset=c?c.offset:request.direction==='older'?messages[index].text.length:0;
 if(!boundary(messages[index].text,offset))throw Error('Invalid transcript cursor character offset.');
 let remaining=MAX_TEXT_BYTES;
 const segments=[];
 let first,last;
 while(index>=0&&index<messages.length&&segments.length<limit){
  const m=messages[index];
  if(typeof m.text!=='string'||!identifier(m.id))throw Error('Invalid transcript message.');
  validateMessageMetadata(m);
  if(m.text.length&&(request.direction==='newer'?offset===m.text.length:offset===0)){
   index+=request.direction==='newer'?1:-1;
   if(index>=0&&index<messages.length)offset=request.direction==='newer'?0:messages[index].text.length;
   continue;
  }
  const slice=boundedSlice(m.text,offset,remaining,request.direction);
  if(m.text.length&&!slice.text.length)break;
  const segment={messageId:m.id,role:m.role,time:m.time,offset:slice.offset,text:slice.text,totalLength:m.text.length};
  const start={index,offset:slice.offset},end={index,offset:slice.end};
  if(request.direction==='newer'){segments.push(segment);first??=start;last=end;}
  else {segments.unshift(segment);first=start;last??=end;}
  remaining-=slice.bytes;
  if(request.direction==='newer'?slice.end<m.text.length:slice.offset>0)break;
  index+=request.direction==='newer'?1:-1;
  if(index>=0&&index<messages.length)offset=request.direction==='newer'?0:messages[index].text.length;
 }
 const cursor=point=>({epoch,taskId:task.id,revision,messageId:messages[point.index].id,offset:point.offset});
 const older=first&&(first.index>0||first.offset>0),newer=last&&(last.index<messages.length-1||last.offset<messages[last.index].text.length);
 if(older)result.previousCursor=cursor(messages[first.index].text.length===0?{index:first.index-1,offset:messages[first.index-1].text.length}:first);
 if(newer)result.nextCursor=cursor(messages[last.index].text.length===0?{index:last.index+1,offset:0}:last);
 return {...result,segments,complete:request.direction==='older'?!older:!newer};
}

module.exports={DEFAULT_PAGE_LIMIT,MAX_PAGE_LIMIT,MAX_TEXT_BYTES,readTranscriptPage,validatePageRequest,validateMessageMetadata,boundary};
