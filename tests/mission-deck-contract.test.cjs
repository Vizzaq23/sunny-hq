const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const {EventEmitter}=require('node:events');
const {createPublicTransport}=require('../desktop/public-transport.cjs');
const root=path.resolve(__dirname,'..');
function source(file,kind){return ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true,kind);}
function descendants(node,predicate){const found=[];function visit(item){if(predicate(item))found.push(item);ts.forEachChild(item,visit);}visit(node);return found;}

test('native fixture dispatch executes the actual transcript hook action through production paging',async()=>{
 const hook=source('src/useTaskTranscript.ts',ts.ScriptKind.TS);
 const actions=descendants(hook,node=>ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='invoke'&&ts.isStringLiteral(node.arguments[0]));
 assert.equal(actions.length,1,'The production hook has one canonical page invocation');
 const action=actions[0].arguments[0].text;
 const fixture=source('scripts/mission-deck-check.cjs',ts.ScriptKind.JS);
 const declarations=descendants(fixture,node=>ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='dispatch'&&ts.isArrowFunction(node.initializer));
 assert.equal(declarations.length,1,'Execute the real fixture dispatch, without launching Electron');
 const hub=new EventEmitter();hub.state={projects:[{id:'fixture',path:root}],missions:[],tasks:[{id:'history',projectId:'fixture',status:'working',messages:[{id:'older',role:'assistant',text:'SYNTHETIC older marker',time:1},{id:'giant',role:'assistant',text:'🧭航海é\n'.repeat(26000),time:2}]}]};
 hub.fixtureTransport=createPublicTransport(hub);
 const owner={isDestroyed:()=>false,webContents:{mainFrame:{}}};
 const event={sender:owner.webContents,senderFrame:owner.webContents.mainFrame};
 const dispatch=new vm.Script('('+declarations[0].initializer.getText(fixture)+')').runInNewContext({assert,Buffer,hub,ownedWindows:new Set([owner]),win:owner,evidence:{ipcCalls:[]}});
 const summary=hub.fixtureTransport.taskReply(hub.state.tasks[0]);
 const request={projectId:'fixture',taskId:'history',epoch:hub.fixtureTransport.producer.epoch,revision:summary.transcriptRevision,direction:'older'};
 const page=await dispatch(event,action,request);
 assert.equal(page.taskId,'history');assert.equal(page.stale,undefined);
 assert.ok(page.previousCursor,'The giant Unicode history requires another bounded page');
 assert.ok(page.segments.reduce((bytes,segment)=>bytes+Buffer.byteLength(segment.text),0)<=256*1024);
 const older=await dispatch(event,action,{...request,cursor:page.previousCursor});
 assert.ok(older.segments.some(segment=>segment.text==='SYNTHETIC older marker'));
 await assert.rejects(dispatch(event,'task:messages',request),/Unexpected fixture IPC/);
 await assert.rejects(dispatch({sender:{mainFrame:{}},senderFrame:{}},action,request),/Owned window only/);
 await assert.rejects(dispatch({...event,senderFrame:{}},action,request),/Main frame only/);
 await assert.rejects(dispatch(event,action,{...request,projectId:'outside'}),/unique registered project/);
});
