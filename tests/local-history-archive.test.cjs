const {test}=require('node:test'),assert=require('node:assert/strict');
const {decodeArchive,createLocalHistory}=require('../desktop/local-history-archive.cjs');
const conversation=(id='chatgpt:one')=>({id,title:'Saved title',projectName:'ChatGPT import',external:true,status:'read only',opaque:{retained:['value',null]},messages:[{id:'stored-first',role:'user',text:''},{id:'stored-middle',role:'assistant',text:('😀漢e\u0301\r\n').repeat(60000),opaque:{also:'retained'}},{id:'stored-last',role:'system',text:'tail'}]});

test('archive preserves every raw byte, compatible field and stored ID while the actual pager reconstructs every segment',async()=>{
 const value=[conversation(),conversation('chatgpt:two')],raw=Buffer.from(' \n'+JSON.stringify(value,null,2)+'\n');
 const archive=decodeArchive(raw);assert.deepEqual(archive.raw,raw);assert.deepEqual(archive.value,value);
 raw.fill(0);assert.equal(archive.raw[0],32,'admission owns its byte snapshot');
 const local=createLocalHistory(archive);assert.deepEqual(local.index(),value.map(({messages,opaque,...metadata})=>metadata));
 for(const expected of value){let page=await local.page({threadId:expected.id,direction:'newer',limit:1}),segments=[];
  for(let count=0;;count++){assert.ok(count<100);segments.push(...page.segments);if(!page.nextCursor){assert.equal(page.complete,true);break;}page=await local.page({threadId:expected.id,sessionId:page.sessionId,revision:1,cursor:page.nextCursor,direction:'newer',limit:1});}
  for(const [ordinal,message]of expected.messages.entries()){const parts=segments.filter(part=>part.messageId===String(ordinal));assert.ok(parts.length);let offset=0;for(const part of parts){assert.equal(part.offset,offset);assert.equal(part.role,message.role);offset+=part.text.length;}assert.equal(parts.map(part=>part.text).join(''),message.text);}
 }
 assert.deepEqual(archive.value,value,'display ordinals must not replace stored IDs');
});
test('archive admission rejects malformed encoding, structure, duplicate identity and unsupported content without an empty fallback',()=>{
 for(const raw of [Buffer.from([0xff]),Buffer.alloc(0),Buffer.from('{}'),Buffer.from('null')])assert.throws(()=>decodeArchive(raw),error=>['ARCHIVE_INVALID','ARCHIVE_UNSUPPORTED'].includes(error.code));
 const base=conversation();for(const value of [[base,base],[{...base,id:'remote'}],[{...base,id:'chatgpt:'}],[{...base,title:3}],[{...base,external:false}],[{...base,messages:[{id:'a',role:'operator',text:'secret'}]}],[{...base,messages:[{id:'a',role:'user',text:{secret:1}}]}]])assert.throws(()=>decodeArchive(Buffer.from(JSON.stringify(value))),{code:'ARCHIVE_UNSUPPORTED'});
 assert.deepEqual(decodeArchive(Buffer.from('[]')).value,[]);
});
test('accumulated archive has no importer 20000-conversation truncation and private documents do not enter the index',()=>{
 const value=Array.from({length:20001},(_,i)=>({...conversation('chatgpt:'+i),messages:[]}));const local=createLocalHistory(decodeArchive(Buffer.from(JSON.stringify(value))));assert.equal(local.index().length,20001);assert.equal(local.index().at(-1).id,'chatgpt:20000');assert.equal('opaque'in local.index()[0],false);
});
test('local history enforces admitted membership before paging and never accepts forged archive authority',async()=>{
 assert.throws(()=>createLocalHistory({raw:Buffer.from('[]'),value:[]}));const local=createLocalHistory(decodeArchive(Buffer.from(JSON.stringify([conversation()]))));
 for(const threadId of ['remote','chatgpt:missing']){assert.throws(()=>local.history(threadId),{code:'LOCAL_HISTORY_NOT_FOUND'});await assert.rejects(local.page({threadId}),{code:'LOCAL_HISTORY_NOT_FOUND'});}
 await assert.rejects(local.page({threadId:'chatgpt:one',extra:'secret'}));const first=await local.page({threadId:'chatgpt:one',limit:1});await local.page({threadId:'chatgpt:one'});assert.equal((await local.page({threadId:'chatgpt:one',sessionId:first.sessionId,revision:1})).stale,true);
});
