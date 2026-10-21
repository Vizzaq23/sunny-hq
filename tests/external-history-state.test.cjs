const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function controller(invoke,publish){const file=path.resolve(__dirname,'../src/externalHistory.ts');assert.ok(fs.existsSync(file),'external history controller exists');const mod=new Module(file,module);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return mod.exports.createExternalHistoryController(invoke,publish);}
const page=(threadId,sessionId='s')=>({threadId,sessionId,revision:1,segments:[{messageId:'0',offset:0,text:'tail',role:'assistant',time:0,totalLength:4}],complete:false,previousCursor:{threadId,sessionId,revision:1,messageId:'0',offset:0}});
test('closing pending external history never reopens modal; later selections win',async()=>{
 const pending=[],states=[];const c=controller((action,args)=>new Promise(resolve=>pending.push({action,args,resolve})),s=>states.push(s));
 const first=c.open({threadId:'a'});assert.equal(states.at(-1).loading,true);c.close();pending[0].resolve(page('a'));await first;assert.equal(states.at(-1),null);
 const a=c.open({threadId:'a'}),b=c.open({threadId:'b'});pending[2].resolve(page('b'));await b;pending[1].resolve(page('a'));await a;assert.equal(states.at(-1).summary.threadId,'b');assert.equal(states.at(-1).page.threadId,'b');
});
test('external navigation replaces one page and displays stale and provider errors',async()=>{
 const calls=[],states=[];let response=page('a');const c=controller(async(action,args)=>{calls.push({action,args});if(response instanceof Error)throw response;return response;},s=>states.push(s));
 await c.open({threadId:'a'});assert.deepEqual(calls[0],{action:'task:readExternalPage',args:{threadId:'a',direction:'older'}});
 response={...page('a'),segments:[{...page('a').segments[0],text:'older'}]};await c.load('older');assert.equal(states.at(-1).page.segments.length,1);assert.equal(states.at(-1).page.segments[0].text,'older');assert.equal(calls[1].args.sessionId,'s');
 response={threadId:'a',stale:true};await c.load('older');assert.match(states.at(-1).error,/reopen|reload/i);assert.equal(states.at(-1).loading,false);
 response=new Error('Cannot read history');await c.reload();assert.equal(states.at(-1).error,'Cannot read history');
});
