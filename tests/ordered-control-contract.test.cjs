const test=require('node:test'),assert=require('node:assert/strict');
const {Script}=require('node:vm');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHash}=require('node:crypto');
const {parseSize,isDirectEntry,validateFrozenTextShape,summarize,explicitFailure,finalizeAndExit,startControlMonitors,rendererControl,makeDispatch,readonlyProof}=require('../scripts/ordered-control-check.cjs');
const {createPublicTransport}=require('../desktop/public-transport.cjs');
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return {promise,resolve};};

test('control matrix fixes one fresh-process size and nearest-rank gates',()=>{
 for(const mib of [1,10,30])assert.equal(parseSize(['--mib='+mib]),mib);
 for(const args of [[],['--mib=2'],['--mib=10','--mib=30'],['--mib=01']])assert.throws(()=>parseSize(args),/exactly one/);
 const samples=Array.from({length:20},(_,n)=>n+1),summary=summarize(samples);
 assert.equal(summary.p95,19);assert.equal(summary.count,20);assert.deepEqual(summary.raw,samples);
 for(const reply of [{success:false},{ok:false},{error:'raw failure'},{failure:{code:'STORE_FAILED'}}])assert.equal(explicitFailure(reply),true);
 assert.equal(explicitFailure({status:'interrupted'}),false);
});

test('actual entry bootstrap runs Electron argv entry even when require.main differs, and keeps imports inert',async()=>{
 const filename=path.resolve(__dirname,'../scripts/ordered-control-check.cjs');
 const source=fs.readFileSync(filename,'utf8');
 const bootstrap=source.split(/\r?\n/).find(line=>line.startsWith('if(isDirectEntry('));
 assert.ok(bootstrap,'Execute the production entry bootstrap itself');
 const script=new Script(bootstrap),current={},electronLoader={},cases=[
  {label:'Electron direct script with nonmatching require.main',electron:'44.4.3',entry:filename,main:electronLoader,expected:1},
  {label:'Electron helper imported by another entry script',electron:'44.4.3',entry:path.join(__dirname,'other-entry.cjs'),main:electronLoader,expected:0},
  {label:'Node helper import',entry:filename,main:electronLoader,expected:0},
  {label:'Node direct main script',entry:filename,main:current,expected:1},
  {label:'Electron missing entry argument',electron:'44.4.3',main:electronLoader,expected:0},
 ];
 for(const item of cases){
  let runs=0;
  const runtime={platform:process.platform,argv:['synthetic-executable',item.entry,'--mib=1'],versions:item.electron?{electron:item.electron}:{}};
  script.runInNewContext({isDirectEntry,process:runtime,require:{main:item.main},module:current,__filename:filename,run:()=>{runs++;return Promise.resolve();},console});
  await Promise.resolve();assert.equal(runs,item.expected,item.label);
 }
 assert.ok(source.includes('show:false'));
 assert.ok(source.includes('offscreen:true,backgroundThrottling:false'));
});

test('production workload validation enforces the declared U+2014 and UTF-8 shape without importing a session fixture',()=>{
 const text='SYNTHETIC 0:0 \u2014 deterministic transcript. '.padEnd(1024,'x');
 const state={tasks:[{messages:Array.from({length:40},()=>({text}))}]};
 const shape=validateFrozenTextShape(state);
 assert.equal(shape.initialTasks,1);assert.equal(shape.initialMessages,40);assert.equal(shape.initialTextCharacters,1024);assert.equal(shape.initialTextUtf8Bytes,1026);assert.equal(shape.nonAsciiCodepoint,8212);assert.equal(shape.nonAsciiPerInitialMessage,1);
 for(const invalid of [text.replace('\u2014','-'),text.replace('x','\u2014'),text.replace('x','\u00e9'),text.slice(1),text+'x']){
  const altered=structuredClone(state);altered.tasks[0].messages[0].text=invalid;assert.throws(()=>validateFrozenTextShape(altered));
 }
 const missing=structuredClone(state);missing.tasks[0].messages.pop();assert.throws(()=>validateFrozenTextShape(missing));
 assert.throws(()=>validateFrozenTextShape({tasks:[]}));
});

test('cleanup rejection remains failed evidence and cannot prevent the final process exit',async()=>{
 const evidence={passed:true,errors:[]},calls=[];
 await finalizeAndExit({cleanup:async()=>{throw Object.assign(Error('SYNTHETIC profile still locked'),{code:'EPERM'});},evidence,write:()=>calls.push('write'),beforeExit:()=>calls.push('before-exit'),exit:code=>calls.push('exit:'+code)});
 assert.equal(evidence.passed,false);assert.equal(evidence.errors[0].phase,'final-cleanup');assert.equal(evidence.errors[0].code,'EPERM');assert.equal(evidence.errors[0].message,'SYNTHETIC profile still locked');
 assert.deepEqual(calls,['write','before-exit','exit:1']);
 const source=fs.readFileSync(path.resolve(__dirname,'../scripts/ordered-control-check.cjs'),'utf8');
 assert.equal(source.includes('fs.rmSync(runtime'),false,'Electron userData is retained until process exit');
 assert.ok(source.includes('runtimeRetainedPath:runtime'));
});

test('production facade rejects foreign frames and awaits pending load and exact Hub completion',async()=>{
 const background=deferred(),durable=deferred(),calls=[],records=[];
 const hub={state:{projects:[{id:'fixture'}],tasks:[{id:'task',projectId:'fixture',messages:[],status:'working'}]},interrupt:async id=>{calls.push('interrupt:'+id);await durable.promise;return {status:'interrupted'};},respond:async args=>{calls.push('respond:'+args.decision);await durable.promise;}};
 const transport=createPublicTransport(hub);
 const owner={isDestroyed:()=>false,webContents:{mainFrame:{}}},event={sender:owner.webContents,senderFrame:owner.webContents.mainFrame};
 const dispatch=makeDispatch({getHub:()=>hub,getTransport:()=>transport,getWindow:()=>owner,records,onControl:async()=>{calls.push('pending');await background.promise;},onControlSettled:()=>calls.push('settled')});
 await assert.rejects(dispatch({...event,sender:{}},'snapshot'),/Owned window/);
 await assert.rejects(dispatch({...event,senderFrame:{}},'snapshot'),/Main frame/);
 await assert.rejects(dispatch(event,'workspace:update',{}),/Unexpected offline/);
 await assert.rejects(dispatch(event,'task:interrupt',{taskId:'task',unexpected:true}),/Unknown task/);
 assert.equal((await dispatch(event,'snapshot')).protocolVersion,2);
 let settled=false;const pending=dispatch(event,'task:interrupt',{taskId:'task'}).then(value=>{settled=true;return value;});
 await Promise.resolve();assert.deepEqual(calls,['pending']);assert.equal(settled,false);
 background.resolve();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,['pending','interrupt:task']);assert.equal(settled,false);
 durable.resolve();assert.deepEqual(await pending,{status:'interrupted'});assert.equal(calls.at(-1),'settled');
 await dispatch(event,'approval:respond',{id:'approval',decision:'decline'});assert.ok(calls.includes('respond:decline'));
});

test('renderer times the actual invoke promise and preserves raw rejected and failure replies',async()=>{
 let now=0,listener,unsubscribed=false;
 const invoke=deferred();
 const context={performance:{now:()=>now},window:{sunny:{subscribe:handler=>{listener=handler;return()=>unsubscribed=true;},invoke:()=>invoke.promise}},requestAnimationFrame:handler=>{now+=7;handler();}};
 const run=new Script('('+rendererControl.toString()+')').runInNewContext(context);
 const pending=run('task:interrupt',{taskId:'task'});now=70;listener({type:'task'});now=135;invoke.resolve({success:false,error:'RAW fixture error'});
 const reply=await pending;assert.equal(reply.rttMs,135);assert.equal(reply.frameAfterSettleMs,7);assert.equal(reply.outcome,'fulfilled');assert.equal(reply.reply.error,'RAW fixture error');assert.equal(explicitFailure(reply.reply),true);assert.equal(unsubscribed,true);
 context.window.sunny.invoke=async()=>{now+=205;throw Error('RAW required barrier rejection');};
 const rejected=await run('approval:respond',{id:'a',decision:'accept'});assert.equal(rejected.rttMs,205);assert.equal(rejected.outcome,'rejected');assert.equal(rejected.error.message,'RAW required barrier rejection');
});

test('continuous 1ms monitor covers later synchronous authority preparation after initial background I/O',async()=>{
 let now=0,stop;const intervals=new Map(),sample={mainContinuous1msExcessMs:[],heartbeatExcessMs:[]},durable=deferred(),background=deferred();
 const clock={now:()=>now,every:(callback,period)=>{intervals.set(period,callback);return period;},cancel:period=>intervals.delete(period)};
 const owner={isDestroyed:()=>false,webContents:{mainFrame:{}}},event={sender:owner.webContents,senderFrame:owner.webContents.mainFrame};
 const hub={interrupt:async()=>{
  // Executed prepare stub models the synchronous full-image clone before store submission.
  assert.ok(intervals.has(1),'Continuous timer must already cover authority preparation');
  now+=145;
  await durable.promise;
  return {status:'interrupted'};
 }};
 const dispatch=makeDispatch({getHub:()=>hub,getTransport:()=>({}),getWindow:()=>owner,records:[],onControl:async()=>{
  stop=startControlMonitors(sample,clock);
  // Initial background capture occurs after monitor arming.
  assert.equal(sample.mainMonitorStartedAtMs,0);now+=25;
  await background.promise;
 },onControlSettled:()=>stop()});
 const pending=dispatch(event,'task:interrupt',{taskId:'control'});
 // The initial handler timer fires during background I/O; it sees only 24ms excess.
 intervals.get(1)();intervals.get(5)();assert.equal(sample.mainContinuous1msExcessMs.at(-1),24);
 now+=5;intervals.get(1)();intervals.get(5)();background.resolve();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(now,175);
 // Continuous timer still sees the subsequent 145ms prepare stall, unlike a one-shot timer.
 intervals.get(1)();intervals.get(5)();
 assert.equal(sample.mainContinuous1msExcessMs.at(-1),144);assert.equal(summarize(sample.mainContinuous1msExcessMs).max>100,true);
 assert.equal(sample.heartbeatExcessMs.at(-1),140);
 // Another last synchronous capture can finish before a timer gets a turn.
 now+=115;durable.resolve();await pending;
 assert.equal(sample.mainMonitorObservations.filter(item=>item.periodMs===1).at(-1).phase,'settlement-tail');
 assert.equal(sample.mainContinuous1msExcessMs.at(-1),114);
 assert.equal(intervals.size,0);const captured=sample.mainMonitorObservations.length;
 now+=1000;stop();assert.equal(sample.mainMonitorObservations.length,captured,'Proof/log work after settlement must be excluded');
});

test('read-only proof compares the whole stored compact row and receipt, including opaque transcript data',async()=>{
 const {DatabaseSync}=require('node:sqlite');
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-control-contract-')),file=path.join(runtime,'state.sqlite'),workers=new Set();
 const expected={projects:[{id:'p',opaqueProject:{keep:1}}],tasks:[{id:'synthetic-0',messages:[{text:'SYNTHETIC complete history',opaqueMessage:{keep:true}}]},{id:'control',status:'interrupted',messages:[]}],missionBook:{opaqueBook:{keep:2},workspace:{drafts:[{text:'SYNTHETIC unsaved draft'}]},missions:[{status:'WAITING_FOR_REVIEW',opaqueMission:{keep:3}}]},opaqueRoot:{keep:4}};
 const compact=JSON.stringify(expected),receipt={stateSha256:createHash('sha256').update(compact).digest('hex')};
 try{
  const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL; CREATE TABLE state (id INTEGER PRIMARY KEY,value TEXT)');db.prepare('INSERT INTO state VALUES(1,?)').run(compact);db.close();
  const proof=await readonlyProof({file,expected,receipt,taskId:'control'},workers);
  assert.equal(proof.exactWholeState,true);assert.equal(proof.receiptMatches,true);assert.equal(proof.task.status,'interrupted');assert.equal(proof.compactBytes,Buffer.byteLength(compact));assert.equal(workers.size,0);
  const altered=structuredClone(expected);altered.tasks[0].messages[0].opaqueMessage.keep=false;
  const mismatch=await readonlyProof({file,expected:altered,receipt:{stateSha256:'0'.repeat(64)},taskId:'control'},workers);
  assert.equal(mismatch.exactWholeState,false);assert.equal(mismatch.receiptMatches,false);
 }finally{for(const worker of workers)await worker.terminate();assert.ok(path.resolve(runtime).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(runtime,{recursive:true,force:true});}
});
