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
function fixtureCallable(name,context){
 const fixture=source('scripts/mission-deck-check.cjs',ts.ScriptKind.JS);
 const nodes=descendants(fixture,node=>(ts.isFunctionDeclaration(node)&&node.name?.text===name)||(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text===name&&ts.isArrowFunction(node.initializer)));
 assert.equal(nodes.length,1,'Exercise the actual fixture '+name);
 const expression=ts.isFunctionDeclaration(nodes[0])?nodes[0].getText(fixture):nodes[0].initializer.getText(fixture);
 return new vm.Script('('+expression+')').runInNewContext({assert,...context});
}

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

test('native reply selection chooses the requested producer before awaiting its exact button',async()=>{
 let chosen='newest-child',clicked;const wanted='coordinator-task';
 const selector='.mission-select-reply[data-task-id="'+wanted+'"]';
 const calls=[];
 const selectReplyProducer=fixtureCallable('selectReplyProducer',{
  select:async(label,taskId)=>{calls.push('select');assert.equal(label,'[aria-label="Reply producer task"]');chosen=taskId;},
  wait:async expression=>{calls.push('wait');const result=new vm.Script(expression).runInNewContext({document:{querySelector:value=>value===selector&&chosen===wanted?{disabled:false}:null}});assert.equal(result,true,'Wait must bind to the exact requested producer button');},
  click:async value=>{calls.push('click');assert.equal(chosen,wanted);clicked=value;}
 });
 await selectReplyProducer(wanted);assert.equal(clicked,selector);assert.deepEqual(calls,['select','wait','click']);
});

test('native Stop retains the actual awaited IPC settlement after in-memory interruption',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});
 const task={id:'stop-task',status:'working'},interruptSettlements=new Map();
 const owner={isDestroyed:()=>false,webContents:{mainFrame:{}}};
 const event={sender:owner.webContents,senderFrame:owner.webContents.mainFrame};
 const hub={lastReceipt:null,interrupt:async()=>{task.status='interrupted';await pending;hub.lastReceipt={sequence:42};return task;},fixtureTransport:{taskReply:value=>value}};
 const dispatch=fixtureCallable('dispatch',{Buffer,hub,ownedWindows:new Set([owner]),win:owner,evidence:{ipcCalls:[]},interruptSettlements,stopFixture:undefined});
 const reply=dispatch(event,'task:interrupt',{taskId:task.id});
 assert.equal(task.status,'interrupted');assert.ok(interruptSettlements.has(task.id),'Observe the real in-flight dispatch promise, not its premature status');
 let settled=false;interruptSettlements.get(task.id).then(()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);
 release();await interruptSettlements.get(task.id);await reply;assert.equal(settled,true);assert.equal(hub.lastReceipt.sequence,42);
});

test('native direct Stop checks the real global gate only after its dispatch settles',async()=>{
 let release;const receiptPending=new Promise(resolve=>{release=resolve;});let durable=false,gateChecks=0;
 const controlTask={id:'control',status:'working'},interruptSettlements=new Map();
 const owner={isDestroyed:()=>false,webContents:{mainFrame:{}}},event={sender:owner.webContents,senderFrame:owner.webContents.mainFrame};
 const evidence={ipcCalls:[],providerCalls:[{method:'turn/interrupt'}]};
 const hub={interrupt:async()=>{controlTask.status='interrupted';await receiptPending;durable=true;return controlTask;},fixtureTransport:{taskReply:value=>value},gate:{blocked:()=>{gateChecks++;assert.equal(durable,true,'The global gate assertion must follow durable Stop settlement');return false;}}};
 const until=async predicate=>assert.equal(predicate(),true);
 const dispatch=fixtureCallable('dispatch',{Buffer,hub,ownedWindows:new Set([owner]),win:owner,evidence,interruptSettlements,stopFixture:undefined});
 const awaitInterruptSettlement=fixtureCallable('awaitInterruptSettlement',{interruptSettlements,until});
 const fixture=source('scripts/mission-deck-check.cjs',ts.ScriptKind.JS);
 const checks=descendants(fixture,node=>ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='check'&&ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text==='direct-stop');
 assert.equal(checks.length,1);
 let actualDispatch;
 const run=new vm.Script('('+checks[0].arguments[1].getText(fixture)+')').runInNewContext({assert,controlTask,hub,evidence,path,runtime:root,wait:async()=>{},until,awaitInterruptSettlement,screenshot:async()=>{},click:async selector=>{if(selector==='.interrupt-button')actualDispatch=dispatch(event,'task:interrupt',{taskId:controlTask.id});}});
 const completion=run();for(let tick=0;tick<8;tick++)await Promise.resolve();assert.equal(controlTask.status,'interrupted');assert.equal(gateChecks,0);
 release();await completion;await actualDispatch;assert.equal(gateChecks,1);
});

test('native acceptance fault is a pre-worker transient refusal and restores the real barrier',async()=>{
 const writes=[],receipt={sequence:1},store={barrier:async(image,reason)=>{writes.push({image,reason});return receipt;}};
 const fault=fixtureCallable('withAcceptancePrewriteFailure',{});
 await fault(store,async()=>{
  await assert.rejects(store.barrier({pending:true},'acceptance'),error=>error.code==='SYNTHETIC_PREWRITE_REJECTED'&&/disk unavailable/.test(error.message));
  assert.deepEqual(writes,[],'Rejected acceptance never enters the real worker barrier');
  assert.equal(await store.barrier({context:true},'workspace'),receipt);
 });
 assert.equal(await store.barrier({complete:true},'acceptance'),receipt);assert.equal(writes.length,2);
});

test('native delegation completes a child only after its turn and launch acknowledgement',async()=>{
 const parent={id:'captain',threadId:'parent-thread',turnId:'parent-turn'},completed=[],pollWaiters=[];
 const hub={state:{tasks:[]},launchingTasks:new Set(),persist:async()=>{},request:request=>{
  const crewId=request.params.arguments.crewId,child={id:crewId,parentTaskId:parent.id,crewId,status:'working'};
  if(crewId==='nami')hub.launchingTasks.add(child.id);else child.turnId='launched-'+crewId;
  hub.state.tasks.push(child);
  return new Promise(resolve=>{child.resolveDelegation=resolve;});
 }};
 const finishStages=fixtureCallable('finishStages',{hub,sequence:1,delay:()=>new Promise(resolve=>pollWaiters.push(resolve)),complete:async task=>{completed.push({id:task.id,turnId:task.turnId,launchPending:hub.launchingTasks.has(task.id)});task.resolveDelegation?.({success:true});}});
 const done=finishStages(parent);done.catch(()=>{});
 const advance=async()=>{for(let tick=0;tick<8;tick++)await Promise.resolve();};
 await advance();assert.deepEqual(completed,[],'Working status before turn/start must not trigger synthetic completion');
 const child=hub.state.tasks[0];child.turnId='actual-child-turn';assert.equal(pollWaiters.length,1);pollWaiters.shift()();await advance();
 assert.deepEqual(completed,[],'Receiving turn identity while Hub launch is still active must not trigger completion');
 assert.equal(pollWaiters.length,1);hub.launchingTasks.delete(child.id);pollWaiters.shift()();await done;
 assert.deepEqual(completed.map(task=>task.id),['nami','franky','usopp','zoro','captain']);
 assert.ok(completed.slice(0,4).every(task=>task.turnId&&!task.launchPending));
});
