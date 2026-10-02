const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const {EventEmitter}=require('node:events');
const ts=require('typescript');
const {createPublicTransport}=require('../desktop/public-transport.cjs');
function fixture(){
 const filename=path.resolve(__dirname,'../desktop/main.cjs'),source=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),declarations=new Map();let ipc;
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name)declarations.set(node.name.text,node.getText(source));if(ts.isCallExpression(node)&&node.expression.getText(source)==='ipcMain.handle'&&node.arguments[0]?.text==='sunny:invoke')ipc=node.arguments[1].getText(source);ts.forEachChild(node,visit);}visit(source);assert.ok(ipc);
 const task={id:'t',projectId:'p',crewId:'franky',status:'finished',messages:[{id:'m',role:'assistant',time:1,text:'秘密🚀'.repeat(100000)}]},hub=new EventEmitter();hub.state={projects:[{id:'p',path:process.cwd()}],tasks:[task],missions:[],approvals:[]};let effects=0;
 for(const method of ['startMission','start','send','interrupt','checkStatus','resolveMissingThread','handoff'])hub[method]=async()=>{effects++;return task;};
 const publicTransport=createPublicTransport(hub,{epoch:'ipc'}),win={isDestroyed:()=>false,webContents:{mainFrame:{}}},companion={isDestroyed:()=>false,webContents:{mainFrame:{}}};
 const context=vm.createContext({require:createRequire(filename),hub,win,companion,publicTransport});
 const handler=new vm.Script(declarations.get('publicState')+'\n'+declarations.get('handle')+'\n('+ipc+')').runInContext(context);
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
