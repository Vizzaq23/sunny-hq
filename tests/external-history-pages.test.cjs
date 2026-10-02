const {test}=require('node:test'),assert=require('node:assert/strict');
let createExternalHistoryPager;try{({createExternalHistoryPager}=require('../desktop/external-history-pages.cjs'));}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const pager=()=>{assert.equal(typeof createExternalHistoryPager,'function','external history pager exists');return createExternalHistoryPager();};
const req=(extra={})=>({threadId:'t',...extra});
test('external pages reconstruct huge Unicode exactly with bounded private display-only pages',async()=>{
 const text=('\u{1f600}\u6f22e\u0301\r\n').repeat(90000)+'\ud800',source={messages:[{role:'user',text:'start',secret:'hidden'},{role:'assistant',text,rpc:{secret:'hidden'},replyRef:{sha256:'forged'}},{role:'assistant',text:'tail'}],privateRpcToken:'hidden'};
 const p=pager();let loads=0;const deps={loadHistory:async()=>{loads++;return source;}};
 let page=await p.readExternalPage(req(),deps),all=page.segments,cursor=page.previousCursor;
 assert.equal(page.revision,1);assert.equal(page.segments.at(-1).text,'tail');
 while(cursor){page=await p.readExternalPage(req({sessionId:page.sessionId,revision:1,cursor,direction:'older'}),deps);all=[...page.segments,...all];cursor=page.previousCursor;}
 assert.equal(loads,1);assert.deepEqual(source.messages.map((_,i)=>all.filter(s=>s.messageId===String(i)).map(s=>s.text).join('')),['start',text,'tail']);
 for(const s of all)assert.deepEqual(Object.keys(s).sort(),['messageId','offset','role','text','time','totalLength']);
 assert.doesNotMatch(JSON.stringify(all),/hidden|forged/);
 page=await p.readExternalPage(req({direction:'newer'}),deps);let forward=[];
 do{assert.ok(Buffer.byteLength(page.segments.map(s=>s.text).join(''))<=256*1024);forward.push(...page.segments);cursor=page.nextCursor;if(cursor)page=await p.readExternalPage(req({sessionId:page.sessionId,revision:1,cursor,direction:'newer'}),deps);}while(cursor);
 assert.equal(forward.filter(s=>s.messageId==='1').map(s=>s.text).join(''),text);
});
test('external sessions replace old reads and reject malformed requests before provider access',async()=>{
 const p=pager();let reads=0;const deps={loadHistory:async()=>{reads++;return Array.from({length:110},()=>({text:'ok'}));}};
 const first=await p.readExternalPage(req(),deps);assert.equal(first.segments.length,50);
 for(const invalid of [{limit:101},{limit:0},{threadId:'x'.repeat(513)},{surprise:1},{sessionId:{secret:1}},{revision:1},{cursor:{}},{direction:'sideways'}])await assert.rejects(p.readExternalPage(req(invalid),deps));assert.equal(reads,1);
 const reopened=await p.readExternalPage(req(),deps);assert.notEqual(first.sessionId,reopened.sessionId);
 const old=await p.readExternalPage(req({sessionId:first.sessionId,revision:1,cursor:first.previousCursor}),deps);assert.deepEqual(old,{threadId:'t',stale:true});
 await assert.rejects(p.readExternalPage(req({threadId:'other',sessionId:reopened.sessionId,revision:1,cursor:reopened.previousCursor}),deps),/cursor/i);
 assert.equal(reads,2);
});
test('concurrent initial loads never restore a replaced session',async()=>{
 const p=pager();let resolve;const pending=p.readExternalPage(req(),{loadHistory:()=>new Promise(r=>resolve=r)});
 const current=await p.readExternalPage(req({threadId:'new'}),{loadHistory:async()=>[{text:'new'}]});resolve([{text:'old'}]);assert.deepEqual(await pending,{threadId:'t',stale:true});
 assert.equal((await p.readExternalPage({threadId:'new',sessionId:current.sessionId,revision:1,direction:'older'},{loadHistory:async()=>assert.fail()})).segments[0].text,'new');
});
test('supported provider wrappers retain text and opaque items show explicit unsupported content',async()=>{
 const p=pager();const detail={thread:{turns:[{items:[{userMessage:{input:[{type:'text',text:'hello'},{text:'world'}]}},{type:'agentMessage',text:'answer'},{type:'tool',text:'SYNTHETIC_PRIVATE_TOKEN'}]}]}};
 const page=await p.readExternalPage(req(),{loadHistory:async()=>detail});assert.deepEqual(page.segments.slice(0,2).map(s=>[s.role,s.text]),[['user','hello\nworld'],['assistant','answer']]);assert.match(page.segments[2].text,/unsupported content/i);assert.doesNotMatch(JSON.stringify(page),/SYNTHETIC_PRIVATE_TOKEN/);
});
test('opaque top-level and nested metadata never becomes text and empty recognized histories stay empty',async()=>{
 const p=pager();for(const detail of [{privateRpcToken:'SYNTHETIC_PRIVATE_TOKEN',request:{rpcId:42}},{messages:[{role:'assistant',text:{internalMetadata:'SYNTHETIC_PRIVATE_TOKEN'}}]},{messages:[{role:'operator',text:'SYNTHETIC_PRIVATE_TOKEN'}]}]){
  const page=await p.readExternalPage(req(),{loadHistory:async()=>detail});assert.doesNotMatch(JSON.stringify(page),/SYNTHETIC_PRIVATE_TOKEN|privateRpcToken|rpcId|internalMetadata/);assert.match(page.segments[0].text,/unsupported content/i);
 }
 for(const detail of [[],{messages:[]},{thread:{turns:[]}},{thread:{turns:[{items:[]}]}},{turns:[]}]){const page=await p.readExternalPage(req(),{loadHistory:async()=>detail});assert.deepEqual(page.segments,[]);assert.equal(page.complete,true);}
});
test('mixed supported text blocks preserve all text and show unsupported content without metadata',async()=>{
 const p=pager(),text='\u{1f600}\u6f22e\u0301\r\n';const detail={messages:[{role:'user',content:[{type:'text',text},{type:'image',image_url:'SYNTHETIC_PRIVATE_TOKEN'},'last']},{role:'assistant',text:{content:[{text:'answer'},{privateRpcToken:'SYNTHETIC_PRIVATE_TOKEN'}]}}]};
 const page=await p.readExternalPage(req(),{loadHistory:async()=>detail});assert.equal(page.segments[0].text,text+'\n[Unsupported content omitted from read-only history.]\nlast');assert.equal(page.segments[1].text,'answer\n[Unsupported content omitted from read-only history.]');assert.doesNotMatch(JSON.stringify(page),/SYNTHETIC_PRIVATE_TOKEN|image_url|privateRpcToken/);
});
test('cursor identity lookup does not normalize unrelated earlier messages',async()=>{
 const p=pager();let normalized=0;const messages=Array.from({length:100},(_,i)=>({role:'assistant',text:{get text(){normalized++;return 'message'+i;}}}));
 const first=await p.readExternalPage(req({limit:1}),{loadHistory:async()=>({messages})});normalized=0;
 const previous=await p.readExternalPage(req({sessionId:first.sessionId,revision:1,cursor:first.previousCursor,limit:1}),{});assert.equal(previous.segments[0].text,'message98');assert.ok(normalized<=3,'only current/boundary messages may be normalized');
});test('top-level turns items preserve supported provider messages',async()=>{
 const p=pager();const detail={turns:[{items:[{type:'userMessage',input:[{type:'text',text:'SUPPORTED_USER_SENTINEL'}]},{type:'agentMessage',text:'SUPPORTED_TEXT_SENTINEL'}]}]};
 const page=await p.readExternalPage(req(),{loadHistory:async()=>detail});assert.deepEqual(page.segments.map(s=>[s.role,s.text]),[['user','SUPPORTED_USER_SENTINEL'],['assistant','SUPPORTED_TEXT_SENTINEL']]);
});
