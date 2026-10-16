const {test}=require('node:test');
const assert=require('node:assert/strict');
let readTranscriptPage,MAX_TEXT_BYTES;
try { ({readTranscriptPage,MAX_TEXT_BYTES}=require('../desktop/transcript-pages.cjs')); } catch(error) { if(error.code!=='MODULE_NOT_FOUND')throw error; }
const message=(id,text)=>({id,role:'assistant',time:1,text});
const fixture=(messages)=>({epoch:'session',revision:1,task:{id:'t',projectId:'p',messages}});
const request=(extra={})=>({projectId:'p',taskId:'t',epoch:'session',revision:1,direction:'newer',...extra});
const page=(context,req)=>{assert.equal(typeof readTranscriptPage,'function','revision-bound page reader must exist');return readTranscriptPage(context,req);};

test('pages_default_to_50_messages_and_allow_at_most_100',()=>{
 const c=fixture(Array.from({length:150},(_,i)=>message('m'+i,'text'+i)));
 const first=page(c,request());assert.equal(first.segments.length,50);assert.equal(first.complete,false);assert.ok(first.nextCursor);
 const last=page(c,request({cursor:first.nextCursor,limit:100}));assert.equal(last.segments.length,100);assert.equal(last.complete,true);assert.equal(last.nextCursor,undefined);
 assert.throws(()=>page(c,request({limit:101})),/limit/i);assert.throws(()=>page(c,request({limit:0})),/limit/i);
});

test('page_rejects_wrong_project_and_malformed_requests_and_cursors',()=>{
 const c=fixture([message('m','😀text')]);page(c,request());
 for(const extra of [{projectId:'wrong'},{taskId:'wrong'},{direction:'sideways'},{revision:1.5},{limit:NaN},{limit:null},{surprise:true},{cursor:{epoch:'session',taskId:'t',revision:1,messageId:'m',offset:1}},{cursor:{epoch:'session',taskId:'wrong',revision:1,messageId:'m',offset:0}},{cursor:{epoch:'session',taskId:'t',revision:1,messageId:'missing',offset:0}},{cursor:{epoch:'session',taskId:'t',revision:1,messageId:'m',offset:999}}])assert.throws(()=>page(c,request(extra)));
});

test('stale_epoch_or_revision_returns_explicit_stale_result_without_text',()=>{
 const c=fixture([message('m','private full text')]);page(c,request());
 for(const extra of [{epoch:'previous'},{revision:0},{cursor:{epoch:'session',taskId:'t',revision:0,messageId:'m',offset:0}}]){
  const result=page(c,request(extra));assert.equal(result.stale,true);assert.equal(result.revision,1);assert.equal(result.segments,undefined);
 }
});

test('pages_reconstruct_complete_unicode_and_huge_message_in_both_directions',()=>{
 const text=('界😀e\u0301\r\n').repeat(120000)+'\ud800';
 const c=fixture([message('empty',''),message('huge',text),message('last','tail')]);page(c,request());
 for(const direction of ['newer','older']){
  let cursor,segments=[],iterations=0;
  do {const result=page(c,request({direction,cursor,limit:100}));assert.ok(result.segments.reduce((sum,s)=>sum+Buffer.byteLength(s.text,'utf8'),0)<=MAX_TEXT_BYTES);
   for(const s of result.segments){assert.equal(s.text,c.task.messages.find(m=>m.id===s.messageId).text.slice(s.offset,s.offset+s.text.length));assert.equal(s.totalLength,c.task.messages.find(m=>m.id===s.messageId).text.length);}
   segments=direction==='newer'?[...segments,...result.segments]:[...result.segments,...segments];cursor=direction==='newer'?result.nextCursor:result.previousCursor;assert.ok(++iterations<100);
  } while(cursor);
  for(const m of c.task.messages)assert.equal(segments.filter(s=>s.messageId===m.id).map(s=>s.text).join(''),m.text);
  const chunks=segments.filter(s=>s.messageId==='huge');for(const s of chunks.slice(1))assert.ok(!(s.offset>0&&/[\ud800-\udbff]/.test(text[s.offset-1])&&/[\udc00-\udfff]/.test(text[s.offset])));
 }
});

test('older_pages_are_chronological_and_stable_identity_cursors_survive_array_insertions',()=>{
 const c=fixture(Array.from({length:6},(_,i)=>message('m'+i,''+i)));
 const last=page(c,request({direction:'older',limit:2}));assert.deepEqual(last.segments.map(s=>s.text),['4','5']);
 c.task.messages.unshift(message('inserted','earlier'));
 const previous=page(c,request({direction:'older',limit:2,cursor:last.previousCursor}));assert.deepEqual(previous.segments.map(s=>s.text),['2','3']);
 assert.equal(previous.nextCursor.messageId,'m3');assert.equal(previous.nextCursor.offset,1);
});

test('empty_history_is_complete_and_message_private_fields_are_not_exposed',()=>{
 assert.deepEqual(page(fixture([]),request()).segments,[]);
 const m={...message('m','hi'),rpc:{secret:'private'},replyRef:{kind:'reply',sha256:'forged'}};const result=page(fixture([m]),request());
 assert.equal(result.complete,true);assert.equal(result.segments[0].rpc,undefined);
 assert.equal(result.segments[0].replyRef,undefined,'canonical reply refs must be added by main from full authoritative messages');
});

test('page_rejects_nested_or_invalid_role_and_timestamp_without_rewriting_history',()=>{
 page(fixture([message('valid','text')]),request());
 for(const fields of [{role:{privateRpcToken:'role-secret'}},{role:['assistant']},{role:'operator'},{role:null},{time:{privateRpcToken:'time-secret'}},{time:'1'},{time:NaN},{time:Infinity},{time:undefined}]){
  const m={...message('m','exact 😀 history'),...fields},c=fixture([m]);
  assert.throws(()=>page(c,request()),/Invalid transcript message metadata/);
  assert.equal(c.task.messages[0],m);assert.equal(m.text,'exact 😀 history');
  for(const key of Object.keys(fields))assert.equal(m[key],fields[key]);
 }
});
