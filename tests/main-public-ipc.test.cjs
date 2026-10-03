const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const {EventEmitter}=require('node:events');
const ts=require('typescript');
const {createPublicTransport}=require('../desktop/public-transport.cjs');
function fixture({packagedMode=false,assetRoot}={}){
 const filename=path.resolve(__dirname,'../desktop/main.cjs'),source=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),declarations=new Map();let ipc;
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name)declarations.set(node.name.text,node.getText(source));if(ts.isCallExpression(node)&&node.expression.getText(source)==='ipcMain.handle'&&node.arguments[0]?.text==='sunny:invoke')ipc=node.arguments[1].getText(source);ts.forEachChild(node,visit);}visit(source);assert.ok(ipc);
 const task={id:'t',projectId:'p',crewId:'franky',status:'finished',messages:[{id:'m',role:'assistant',time:1,text:'秘密🚀'.repeat(100000)}]},hub=new EventEmitter();hub.state={projects:[{id:'p',path:process.cwd()}],tasks:[task],missions:[],approvals:[]};let effects=0;
 for(const method of ['startMission','start','send','interrupt','checkStatus','resolveMissingThread','handoff'])hub[method]=async()=>{effects++;return task;};
 const publicTransport=createPublicTransport(hub,{epoch:'ipc'}),win={isDestroyed:()=>false,webContents:{mainFrame:{}}},companion={isDestroyed:()=>false,webContents:{mainFrame:{}}};
 const externalHistoryPager=require('../desktop/external-history-pages.cjs').createExternalHistoryPager();
 hub.ensure=async()=>{};hub.client={request:async()=>({thread:{turns:[{items:[{type:'agentMessage',text:'provider text '.repeat(90000)}]}]}})};
 const context=vm.createContext({fs,path,__dirname:assetRoot?path.join(assetRoot,'desktop'):path.dirname(filename),require:createRequire(filename),fixture:packagedMode?{}:null,packagedFixture:require('../desktop/packaged-acceptance.cjs'),hub,win,companion,publicTransport,externalHistoryPager,importedHistory:()=>[{id:'chatgpt:fixture',messages:[{role:'user',text:'import text '.repeat(90000)}]}]});
 const handler=new vm.Script(declarations.get('textArg')+'\n'+declarations.get('loadExternalHistory')+'\n'+declarations.get('publicState')+'\n'+declarations.get('handle')+'\n('+ipc+')').runInContext(context);
 return {task,hub,publicTransport,win,companion,handler,get effects(){return effects;},invoke(action,args={},target=win){return handler({sender:target.webContents,senderFrame:target.webContents.mainFrame},action,args);}};
}
test('actual main read routes return bounded protocol state and unchanged read sequence',async()=>{
 const f=fixture(),snapshot=await f.invoke('snapshot');assert.equal(snapshot.protocolVersion,2);assert.equal(snapshot.tasks,undefined);assert.equal(snapshot.epoch,'ipc');assert.ok(JSON.stringify(snapshot).length<5000);
 const request={projectId:'p',taskId:'t',epoch:'ipc',revision:1,direction:'older'},page=await f.invoke('transcript:page',request);assert.ok(page.segments.reduce((n,s)=>n+Buffer.byteLength(s.text),0)<=256*1024);assert.equal((await f.invoke('snapshot')).sequence,0);assert.equal(f.effects,0);
});
test('every actual main task action response is projected without its full transcript',async()=>{
 const f=fixture();for(const [action,args] of [['mission:start',{missionId:'m',revision:1}],['task:start',{projectId:'p',crewId:'franky',prompt:'synthetic'}],['task:send',{taskId:'t',prompt:'synthetic'}],['task:interrupt',{taskId:'t'}],['task:checkStatus',{taskId:'t'}],['task:resolveMissingThread',{taskId:'t'}],['task:handoff',{taskId:'t',crewId:'franky',prompt:'synthetic'}]]){
  const reply=await f.invoke(action,args);assert.equal(reply.id,'t');assert.equal(reply.messages,undefined);assert.ok(JSON.stringify(reply).length<5000);
 }assert.equal(f.effects,7);
});
test('actual main IPC rejects another sender or child frame before reading history or effects',async()=>{
 const f=fixture(),request={projectId:'p',taskId:'t',epoch:'ipc',revision:1,direction:'older'};
 await assert.rejects(f.handler({sender:{mainFrame:{}},senderFrame:{}},'transcript:page',request),/Untrusted window/);
 await assert.rejects(f.handler({sender:f.win.webContents,senderFrame:{}},'task:interrupt',{taskId:'t'}),/Untrusted window/);
 await assert.rejects(f.invoke('transcript:page',{...request,projectId:'outside'},f.companion),/unique registered project/);assert.equal(f.effects,0);
});
test('quiescent actual main still permits read-only paging and blocks new task work',async()=>{
 const f=fixture();f.hub.quiescing=true;assert.ok((await f.invoke('transcript:page',{projectId:'p',taskId:'t',epoch:'ipc',revision:1,direction:'older'})).segments.length);
 await assert.rejects(f.invoke('task:start',{projectId:'p',crewId:'franky',prompt:'synthetic'}),/stopping/);assert.equal(f.effects,0);
});
test('actual main bounds both external-history routes and preserves complete imported/provider text',async()=>{
 const f=fixture();
 for(const [threadId,expected] of [['chatgpt:fixture','import text '.repeat(90000)],['provider-fixture','provider text '.repeat(90000)]]){
  let page=await f.invoke('task:readExternal',{threadId,direction:'newer'}),text='',count=0;
  while(true){assert.equal(page.messages,undefined);assert.equal(page.thread,undefined);assert.ok(page.segments.reduce((n,s)=>n+Buffer.byteLength(s.text),0)<=256*1024);text+=page.segments.map(s=>s.text).join('');count++;
   if(!page.nextCursor)break;
   page=await f.invoke('task:readExternalPage',{threadId,sessionId:page.sessionId,revision:page.revision,cursor:page.nextCursor,direction:'newer'});
  }
  assert.ok(count>1);assert.equal(text,expected);
 }
 assert.equal((await f.invoke('snapshot')).sequence,0);assert.equal(f.effects,0);
 await assert.rejects(f.invoke('task:readExternalPage',{threadId:'provider-fixture',extra:true}),/Invalid external/);
});


test('actual main fixture IPC keeps trusted reads and blocks ordinary task effects',async()=>{
 const f=fixture({packagedMode:true});assert.equal((await f.invoke('snapshot')).protocolVersion,2);
 await assert.rejects(f.invoke('task:start',{projectId:'p',crewId:'franky',prompt:'synthetic'}),/Offline fixture blocks/);
 await assert.rejects(f.invoke('mission:start',{missionId:'m',revision:1}),/Offline fixture blocks/);
 await assert.rejects(f.handler({sender:f.win.webContents,senderFrame:{}},'snapshot'),/Untrusted window/);
 assert.equal(f.effects,0);
});

test('actual main fixture permits only validated fixed packaged crew texture reads',async t=>{
 const root=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'sunny-ipc-assets-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'dist','assets'),{recursive:true});
 const f=fixture({packagedMode:true,assetRoot:root});const assets={crew:'crew-deck-sprites.png',blimp:'morgans-blimp-key.png',actions:'crew-actions.png',ship:'ship-companion-key.png',walk:'crew-walk.png',states:'crew-pet-states.png',residents:'island-residents.png'};
 for(const [kind,name] of Object.entries(assets)){const bytes=Buffer.from('owned texture '+kind);fs.writeFileSync(path.join(root,'dist','assets',name),bytes);assert.equal(await f.invoke('asset:crewTexture',{kind}),'data:image/png;base64,'+bytes.toString('base64'));}
 for(const args of [{kind:'../../secret'},{kind:'__proto__'},{kind:'ship',path:'outside'},null,[]])await assert.rejects(f.invoke('asset:crewTexture',args),/fixture|texture/i);
 await assert.rejects(f.invoke('skills:suggest',{projectId:'p',brief:'synthetic',roleId:'luffy'}),/Offline fixture blocks/);assert.equal(f.effects,0);
});
test('actual main run IPC validates before calling authority and projects only public run fields',async()=>{
 const f=fixture(),run={id:'r',projectId:'p',missionIds:[],revision:0,phase:'planning',assignments:[],decisions:[],grant:{id:'g',scope:{projectId:'p',objective:'Inspect',activities:['read']},privateSecret:'hidden'},workspaces:[{canonicalRoot:'private checkout'}],coordinatorCalls:[{response:'private transport'}],privateSecret:'hidden'};f.hub.state.runs=[run];let calls=0;
 f.hub.createRun=async()=>{calls++;return run;};f.hub.controlRun=async()=>{calls++;return {run,effects:[{type:'private-effect'}]};};f.hub.setRunGrant=async()=>{calls++;return {run};};f.hub.inspectRun=()=>{calls++;return run;};
 for(const action of ['run:inspect','run:control']){const result=await f.invoke(action,action==='run:inspect'?{runId:'r',projectId:'p'}:{runId:'r',projectId:'p',expectedRevision:0,control:'pause'});assert.equal(result.id,'r');assert.equal(result.workspaces,undefined);assert.equal(result.coordinatorCalls,undefined);assert.equal(result.privateSecret,undefined);assert.equal(result.effects,undefined);assert.equal(result.grant.privateSecret,undefined);}
 assert.equal(calls,2);await assert.rejects(f.invoke('run:control',{runId:'r',projectId:'p',control:'stop'}),/Invalid/);await assert.rejects(f.invoke('run:control',{runId:'r',projectId:'p',expectedRevision:0,control:'stop',grant:{}}),/Invalid/);await assert.rejects(f.handler({sender:f.win.webContents,senderFrame:{}},'run:control',{runId:'r',projectId:'p',expectedRevision:0,control:'pause'}),/Untrusted/);assert.equal(calls,2);
 f.hub.quiescing=true;assert.equal((await f.invoke('run:inspect',{runId:'r',projectId:'p'})).id,'r');await assert.rejects(f.invoke('run:control',{runId:'r',projectId:'p',expectedRevision:0,control:'stop'}),/stopping/);
});
