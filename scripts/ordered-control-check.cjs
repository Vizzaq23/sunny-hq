// OFFLINE SYNTHETIC verification only. Launch one size per fresh Electron 44 process.
// The coordinator runs this after freezing sources/build; this file never builds or launches Electron.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..');
const SAMPLES=20,WARMUPS=3,WATCHDOG_MS=240000;
const FROZEN_FIXTURE_SHA256='219f75242146fb32b8ed8452a0b792b1c76207311b67f74b947b267cc8581590';
const FROZEN_PROTOCOL_SHA256='cfbf13474db6cfd574cd072e386a9db405168e587eb0ac9be4f0297650a63afd';
const sha=value=>createHash('sha256').update(value).digest('hex');
function resolveControlInputs(root){
 const fixtureFile=path.resolve(root,'tests/helpers/frozen-control-fixture.cjs');
 const protocolFile=path.resolve(root,'docs/evidence/protocols/ordered-control-2026-10-02.md');
 const fixtureSha256=sha(fs.readFileSync(fixtureFile)),protocolSha256=sha(fs.readFileSync(protocolFile));
 assert.equal(fixtureSha256,FROZEN_FIXTURE_SHA256,'Frozen fixture source hash must match before samples');
 assert.equal(protocolSha256,FROZEN_PROTOCOL_SHA256,'Frozen protocol source hash must match before samples');
 return {fixtureFile,protocolFile,fixtureSha256,protocolSha256};
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function summarize(values){
 const sorted=[...values].sort((a,b)=>a-b),pick=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];
 return {count:sorted.length,min:sorted[0]??null,p50:sorted.length?pick(.5):null,p95:sorted.length?pick(.95):null,max:sorted.at(-1)??null,raw:values};
}
function parseSize(args){
 const values=args.filter(arg=>arg.startsWith('--mib='));
 if(values.length!==1||!/^--mib=(1|10|30)$/.test(values[0]))throw Error('Run exactly one --mib=1, --mib=10 or --mib=30 in a fresh Electron process.');
 return Number(values[0].slice(6));
}
function validateFrozenTextShape(state){
 assert.ok(Array.isArray(state?.tasks)&&state.tasks.length>0,'Frozen fixture must contain tasks');
 let messages=0;
 for(const task of state.tasks){
  assert.ok(Array.isArray(task.messages)&&task.messages.length===40,'Frozen fixture requires 40 messages per task');
  for(const message of task.messages){
   assert.equal(typeof message.text,'string');
   assert.equal(message.text.length,1024,'Frozen initial message must contain 1024 characters');
   const nonAscii=Array.from(message.text).map(character=>character.codePointAt(0)).filter(codepoint=>codepoint>127);
   assert.deepEqual(nonAscii,[8212],'Frozen message requires exactly one U+2014 and otherwise ASCII codepoints');
   assert.equal(Buffer.byteLength(message.text,'utf8'),1026,'Frozen initial message must contain 1026 UTF-8 bytes');messages++;
  }
 }
 return {initialTasks:state.tasks.length,initialMessages:messages,messagesPerTask:40,initialTextCharacters:1024,initialTextUtf8Bytes:1026,nonAsciiCodepoint:8212,nonAsciiPerInitialMessage:1};
}
// Electron's app-entry loader can leave require.main pointing at its bootstrap.
// Match the explicit entry script too, while keeping helper imports inert.
function isDirectEntry(runtime,main,current,filename){
 if(main===current)return true;
 const entry=runtime.argv?.[1];
 if(!runtime.versions?.electron||typeof entry!=='string'||!entry)return false;
 const normalize=file=>runtime.platform==='win32'?path.resolve(file).toLowerCase():path.resolve(file);
 return normalize(entry)===normalize(filename);
}
function failure(error){return {name:error?.name||'Error',code:error?.code||null,message:String(error?.message||error),stack:String(error?.stack||error)};}
function explicitFailure(reply){return Boolean(reply&&typeof reply==='object'&&(reply.success===false||reply.ok===false||reply.failure||reply.error));}
async function finalizeAndExit({cleanup,evidence,write,beforeExit=()=>{},exit}){
 const report=(phase,error)=>{
  evidence.errors.push({phase,...failure(error)});evidence.passed=false;
  try{write();}catch(writeError){evidence.errors.push({phase:'final-evidence-write',...failure(writeError)});console.error('SUNNY_ORDERED_CONTROL_FINAL_WRITE_FAILED',failure(writeError));}
 };
 try{await cleanup();}catch(error){report('final-cleanup',error);}
 finally{
  try{beforeExit();}catch(error){report('final-exit-preparation',error);}
  finally{exit(evidence.passed===true?0:1);}
 }
}
// Start before any background/authority image capture and stay armed through all
// awaited control receipts. Sample the outstanding deadline at settlement too:
// a last synchronous capture can finish in a microtask before its timer callback.
function startControlMonitors(sample,clock={now:()=>performance.now(),every:setInterval,cancel:clearInterval}){
 const started=clock.now();sample.mainMonitorStartedAtMs=started;
 const streams=[{period:1,values:sample.mainContinuous1msExcessMs},{period:5,values:sample.heartbeatExcessMs}];
 sample.mainMonitorObservations=[];let stopped=false;
 for(const stream of streams){
  stream.last=started;
  stream.observe=(phase)=>{const now=clock.now(),excessMs=Math.max(0,now-stream.last-stream.period);stream.values.push(excessMs);sample.mainMonitorObservations.push({periodMs:stream.period,phase,atMs:now-started,excessMs});stream.last=now;};
  stream.timer=clock.every(()=>stream.observe('timer'),stream.period);
 }
 return ()=>{if(stopped)return;stopped=true;for(const stream of streams){stream.observe('settlement-tail');clock.cancel(stream.timer);}sample.mainMonitorSettledAtMs=clock.now();};
}
function sourceProof(){
 const {fixtureSha256,protocolSha256}=resolveControlInputs(root);
 const git=args=>execFileSync('git',['-c','safe.directory='+root,...args],{cwd:root,windowsHide:true,encoding:'utf8'});
 const files=[...new Set(git(['ls-files','-z','--cached','--others','--exclude-standard']).split('\0').filter(Boolean))].sort();
 const manifest=files.filter(file=>fs.existsSync(path.join(root,file))&&fs.statSync(path.join(root,file)).isFile()).map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
 // Built files are ignored by Git, so bind every dist asset separately.
 function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
 const built=walk(path.join(root,'dist')).sort().map(file=>({file:path.relative(root,file).split(path.sep).join('/'),sha256:sha(fs.readFileSync(file))}));
 return {commit:git(['rev-parse','HEAD']).trim(),dirty:Boolean(git(['status','--porcelain','--untracked-files=normal']).trim()),sourceDigest:sha(JSON.stringify(manifest)),manifest,builtDigest:sha(JSON.stringify(built)),built,fixtureSha256,protocolSha256};
}

// Timing begins inside the renderer immediately before the real production preload invoke.
// executeJavaScript scheduling/return overhead is outside this RTT. Raw rejected replies survive.
async function rendererControl(action,args){
 const events=[];let started;
 const unsubscribe=window.sunny.subscribe(event=>events.push({type:event.type,atMs:performance.now()-started}));
 let reply,outcome,error;
 started=performance.now();
 try{reply=await window.sunny.invoke(action,args);outcome='fulfilled';}
 catch(caught){outcome='rejected';error={name:caught.name,message:caught.message,stack:caught.stack};}
 const settled=performance.now(),rttMs=settled-started;
 unsubscribe();
 const frameAfterSettleMs=await new Promise(resolve=>requestAnimationFrame(()=>resolve(performance.now()-settled)));
 return {rttMs,outcome,reply,error,events,frameAfterSettleMs};
}

function makeDispatch({getHub,getTransport,getWindow,records,onControl,onControlSettled=()=>{}}){
 return async(event,action,args={})=>{
  const win=getWindow();
  if(!win||win.isDestroyed()||event.sender!==win.webContents)throw Error('Owned window only');
  if(event.senderFrame!==win.webContents.mainFrame)throw Error('Main frame only');
  const hub=getHub(),transport=getTransport();
  require('../desktop/task-commands.cjs').validateTaskCommand(action,args);
  records.push({action});
  switch(action){
  case 'snapshot':return transport.snapshot();
  case 'transcript:page':return transport.page(args);
  case 'mission:resultStatus':return transport.resultStatus(args);
  case 'workspace:get':
   if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)throw Error('Invalid workspace query.');
   return hub.state.workspace;
  case 'files:list':{
   const {guardedPath}=require('../desktop/core.cjs'),project=hub.project(args.projectId),directory=guardedPath(project.path,args.path||'');
   return fs.readdirSync(directory,{withFileTypes:true}).filter(entry=>!entry.isSymbolicLink()).map(entry=>({name:entry.name,path:path.join(directory,entry.name),directory:entry.isDirectory()})).sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name));
  }
  case 'files:read':return require('../desktop/core.cjs').readText(hub.project(args.projectId).path,args.path);
  case 'task:interrupt':
   try{await onControl(action,args);return await hub.interrupt(args.taskId);}finally{onControlSettled(action);}
  case 'approval:respond':
   try{await onControl(action,args);return await hub.respond(args);}finally{onControlSettled(action);}
  default:throw Error('Unexpected offline fixture IPC '+action);
  }
 };
}

// All full serialization, SQLite reads and digest comparisons happen away from main,
// after measured invokes and exact receipts. The actual compact row is compared in full.
const READONLY_PROOF=`
const {parentPort,workerData}=require('node:worker_threads');
const {DatabaseSync}=require('node:sqlite');const {createHash}=require('node:crypto');
let db;try{
 db=new DatabaseSync(workerData.file,{readOnly:true});
 const compact=db.prepare('SELECT value FROM state WHERE id=1').get().value;
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const state=JSON.parse(compact),expectedCompact=JSON.stringify(workerData.expected);
 const persisted=state.tasks.find(task=>task.id===workerData.taskId);
 const proof={compactBytes:Buffer.byteLength(compact),stateSha256:hash(compact),expectedStateSha256:hash(expectedCompact),exactWholeState:compact===expectedCompact,receiptMatches:hash(compact)===workerData.receipt.stateSha256,task:persisted?{id:persisted.id,status:persisted.status,threadId:persisted.threadId,turnId:persisted.turnId,executionId:persisted.executionId,approvalResponseIntent:persisted.approvalResponseIntent}:null,fixtureTasks:state.tasks.filter(task=>task.id.startsWith('synthetic-')).length,fullTranscriptsSha256:hash(JSON.stringify(state.tasks.map(task=>({id:task.id,messages:task.messages})))),workspaceSha256:hash(JSON.stringify(state.missionBook.workspace)),opaqueRoot:state.opaqueRoot,opaqueBook:state.missionBook.opaqueBook,opaqueProject:state.projects[0].opaqueProject,opaqueMission:state.missionBook.missions[0].opaqueMission,missionStatus:state.missionBook.missions[0].status,journalMode:db.prepare('PRAGMA journal_mode').get().journal_mode};
 parentPort.postMessage({proof});
}catch(error){parentPort.postMessage({error:{name:error.name,message:error.message,stack:error.stack}});}finally{db?.close();parentPort.close();}`;
async function readonlyProof(data,workers){
 const worker=new Worker(READONLY_PROOF,{eval:true,workerData:data});workers.add(worker);
 try{return await new Promise((resolve,reject)=>{
  let delivered=false;
  worker.once('message',message=>{delivered=true;message.error?reject(Object.assign(Error(message.error.message),message.error)):resolve(message.proof);});
  worker.once('error',reject);worker.once('exit',code=>{if(!delivered)reject(Error('Read-only proof exited without result: '+code));});
 });}finally{await worker.terminate();workers.delete(worker);}
}

async function run(){
 const mib=parseSize(process.argv.slice(2)),latencyProbe=process.argv.includes('--latency-probe');
 const {fixtureFile}=resolveControlInputs(root);
 const {app,BrowserWindow,ipcMain,session}=require('electron');
 assert.equal(Number(process.versions.electron.split('.')[0]),44,'Use the exact approved Electron 44 executable');
 const {Hub}=require('../desktop/hub.cjs');
 const {openOrderedStore}=require('../desktop/ordered-store.cjs');
 const {createPublicTransport}=require('../desktop/public-transport.cjs');
 const {fixture}=require('../tests/helpers/frozen-control-loader.cjs').loadFrozenControlFixture(fixtureFile,root);
 const output=path.join(root,'.sunny-dev','ordered-control-check',new Date().toISOString().replace(/[:.]/g,'-')+'-'+mib+'MiB');
 fs.mkdirSync(output,{recursive:true});
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-ordered-control-'));
 app.setPath('userData',path.join(runtime,'electron-profile'));
 const project=path.join(runtime,'project');fs.mkdirSync(project);fs.writeFileSync(path.join(project,'fixture.txt'),'SYNTHETIC offline read fixture\n');
 const file=path.join(runtime,'state.sqlite'),workers=new Set(),timers=new Set();
 const evidence={synthetic:true,sizeMiB:mib,startedAt:new Date().toISOString(),output,source:sourceProof(),runtime:{electron:process.versions.electron,node:process.versions.node,chrome:process.versions.chrome,executable:process.execPath,executableSha256:sha(fs.readFileSync(process.execPath)),platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},method:{samplesPerControl:SAMPLES,warmupsPerControl:WARMUPS,percentile:'nearest-rank',controls:['task:interrupt','approval:respond'],pendingBackground:'At actual control IPC entry, inject one production Hub checkpoint, then yield one setImmediate before the real Hub control. Require actual native checkpoint promise pending and authority queue active at control admission. If already settled, retain the raw rejected sample as invalid load. Worker/receipt delivery unmodified.',rtt:'Renderer performance.now immediately before await window.sunny.invoke to fulfilled/rejected settlement; includes background load injection/capture, authority queue waiting and all required durable receipts; executeJavaScript overhead excluded',timer:'Continuous independent 1ms monitor starts before background prepare/image capture and stays armed through real Hub control and every required receipt; records every raw observation plus settlement-tail deadline excess. All raw max <=100ms. Supplementary per-submit/admission/handler timers and twenty idle controls are retained without subtraction.',heartbeat:'Separate continuous 5ms interval across the same main control window, with settlement-tail observation; never substitutes for the 1ms metric',excludedFromMainMonitor:'Renderer executeJavaScript return/frame overhead, readonly proof workers and result/log JSON serialization after Hub control settlement',mutation:'Append 64 ASCII x characters outside each warmup/sample',noGC:true,noNetwork:true,sqlite:'production WAL/FULL; existing compact single-row state'},assertions:[],errors:[],ipcCalls:[],providerCalls:[],submissions:[],warmups:[],samples:[],timerControls:[]};
 evidence.method.fixtureDescription='Exact frozen predominantly ASCII fixture: 40 messages per task; each initial message is 1024 characters / 1026 UTF-8 bytes, with exactly one U+2014 em dash and otherwise ASCII codepoints. Fixture contents are unchanged.';
 evidence.method.fixtureSha256=FROZEN_FIXTURE_SHA256;
 evidence.method.fixtureDescriptionCorrection='The earlier ASCII-only descriptor was incorrect for the frozen source. The failed ASCII bootstrap is retained as failure evidence. This corrects workload labeling and shape validation; it does not replace the fixture or change samples, queue/load, timing, durability, or the 100ms/200ms gates.';
 let hub,store,win,transport,finished=false,cleanupPromise,currentSample=null,stopMainMonitors;
 evidence.latencyProbe={enabled:latencyProbe,limit:2048,overflow:0,queue:[],worker:[]};
 const observe=kind=>record=>{const list=evidence.latencyProbe[kind];if(list.length<evidence.latencyProbe.limit)list.push({...record,sampleId:currentSample?.id??null});else evidence.latencyProbe.overflow++;};
 const probeOptions=latencyProbe?{latencyProbe:true,observeCommit:observe('worker')}:{};
 const write=()=>fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2));
 const log=(kind,details)=>{fs.appendFileSync(path.join(output,'events.jsonl'),JSON.stringify({kind,...details})+'\n');};
 function check(name,condition,details){const item={name,status:condition?'pass':'fail',details};evidence.assertions.push(item);log('assertion',item);write();return condition;}
 const oneMs=(list,label)=>{const start=performance.now();let timer;const promise=new Promise(resolve=>{timer=setTimeout(()=>{timers.delete(timer);const excessMs=Math.max(0,performance.now()-start-1);list.push({label,excessMs});resolve(excessMs);},1);timers.add(timer);});return promise;};
 async function cleanup(){
  if(cleanupPromise)return cleanupPromise;
  cleanupPromise=(async()=>{
   evidence.cleanup={runtimeRetainedPath:runtime,userDataRetainedPath:path.join(runtime,'electron-profile'),runtimeRetained:true,windowsDestroyed:false,orderedStoreClosed:false,readonlyWorkersTerminated:0};
   const recordCleanupError=(phase,error)=>{evidence.errors.push({phase,...failure(error)});evidence.passed=false;};
   stopMainMonitors?.();stopMainMonitors=null;
   for(const timer of timers)clearTimeout(timer);timers.clear();
   try{if(win&&!win.isDestroyed())win.destroy();evidence.cleanup.windowsDestroyed=!win||win.isDestroyed();}catch(error){recordCleanupError('cleanup-window',error);}
   try{if(hub)await hub.close();else await store?.close();evidence.cleanup.orderedStoreClosed=true;}catch(error){
    recordCleanupError('cleanup-storage',error);
    try{await store?.close();evidence.cleanup.orderedStoreClosed=true;}catch(closeError){recordCleanupError('cleanup-storage-retry',closeError);}
   }
   for(const worker of [...workers])try{await worker.terminate();workers.delete(worker);evidence.cleanup.readonlyWorkersTerminated++;}catch(error){recordCleanupError('cleanup-readonly-worker',error);}
   evidence.cleanup.readonlyWorkersRemaining=workers.size;
   evidence.finishedAt=new Date().toISOString();write();
   // Chromium still owns userData files until app.exit. Retain this synthetic
   // runtime for review; never recursively delete a live Electron profile.
  })();return cleanupPromise;
 }
 const watchdog=setTimeout(()=>{
  evidence.errors.push({phase:'watchdog',message:'240s internal watchdog expired'});write();
  void Promise.race([cleanup(),pause(5000)]).finally(()=>{for(const worker of workers)void worker.terminate();app.exit(1);});
 },WATCHDOG_MS);
 app.on('window-all-closed',()=>{});
 app.on('before-quit',event=>{if(!finished){event.preventDefault();void cleanup().finally(()=>{finished=true;app.exit(1);});}});
 process.on('uncaughtException',error=>{evidence.errors.push({phase:'uncaughtException',...failure(error)});write();void cleanup().finally(()=>app.exit(1));});
 process.on('unhandledRejection',error=>{evidence.errors.push({phase:'unhandledRejection',...failure(error)});write();void cleanup().finally(()=>app.exit(1));});
 try{
  await app.whenReady();
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{const local=/^(file:|devtools:)/.test(details.url);if(!local)evidence.errors.push({phase:'network-denied',scheme:details.url.split(':')[0]});callback({cancel:!local});});
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  store=await openOrderedStore({kind:'sqlite',file,backupDir:path.join(runtime,'backups'),...probeOptions});
  assert.equal(evidence.source.fixtureSha256,FROZEN_FIXTURE_SHA256,'Declared frozen fixture source hash must match');
  assert.equal(sha(fs.readFileSync(fixtureFile)),FROZEN_FIXTURE_SHA256,'Frozen fixture source must remain unchanged before samples');
  const initial=fixture(mib,runtime);
  evidence.fixture={initialCompactBytes:Buffer.byteLength(JSON.stringify(initial)),...validateFrozenTextShape(initial),fixtureSha256:FROZEN_FIXTURE_SHA256,missionTasks:initial.missionBook.missions[0].taskIds,initialMissionStatus:initial.missionBook.missions[0].status};
  check('exact declared frozen workload shape and hash validated before samples',true,evidence.fixture);initial.projects[0].path=project;
  evidence.initialReceipt=await store.checkpoint(initial);
  // Hub reads OrderedStore's initialization image. Reopen after the exact initial receipt.
  await store.close();
  store=await openOrderedStore({kind:'sqlite',file,backupDir:path.join(runtime,'backups'),...probeOptions});
  const nativeStore=store;
  store={load:()=>nativeStore.load(),flush:()=>nativeStore.flush(),close:()=>nativeStore.close(),get recovery(){return nativeStore.recovery;},checkpoint:image=>submit(image,null),barrier:(image,reason)=>submit(image,reason)};
  function submit(image,reason){
   const sample=currentSample,record={sampleId:sample?.id??null,reason,startedAtMs:performance.now()};evidence.submissions.push(record);
   if(sample)sample.timerPromises.push(oneMs(sample.mainTimers,'store submit '+String(reason)));
   if(sample&&reason===null){sample.nativeCheckpointSubmittedAtMs=performance.now();sample.nativeCheckpointPending=true;}
   const start=performance.now();const promise=reason===null?nativeStore.checkpoint(image):nativeStore.barrier(image,reason);record.syncHandoffMs=performance.now()-start;
   return promise.then(receipt=>{record.receipt=receipt;record.awaitedReceiptMs=performance.now()-record.startedAtMs;return receipt;},error=>{record.failure=failure(error);throw error;}).finally(()=>{if(sample&&reason===null)sample.nativeCheckpointPending=false;});
  }
  hub=new Hub({home:runtime,store,catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]}});
  const forbid=async()=>{throw Error('OFFLINE fixture forbids provider process/connection');};
  if(latencyProbe)hub.authorityQueue.observeCommit=observe('queue');
  hub.connect=forbid;hub.connectCodex=forbid;hub.client.start=forbid;hub.client.connect=forbid;
  await hub.initializeRecovery();check('mandatory startup recovery awaited',hub.recoveryReady===true);
  transport=createPublicTransport(hub);transport.bindTranscript(envelope=>{if(win&&!win.isDestroyed())win.webContents.send('sunny:event',envelope);});
  hub.client.connected=true;hub.state.codex={status:'connected',version:'SYNTHETIC OFFLINE'};
  hub.client.request=async(method,args)=>{
   evidence.providerCalls.push({method,...(currentSample?{sampleId:currentSample.id}:{})});
   const task=hub.state.tasks.find(task=>task.threadId===args?.threadId);
   if(method==='turn/interrupt'){assert.equal(args.turnId,task.turnId);return {};}
   if(method==='thread/read')return {thread:{id:task.threadId,status:'active',turns:[{id:task.turnId,status:'inProgress'}]}};
   if(method==='thread/start')return {thread:{id:'offline-thread'}};
   if(method==='turn/start')return {turn:{id:'offline-turn'}};
   throw Error('Unexpected offline provider request '+method);
  };
  hub.client.respond=(id,result)=>{evidence.providerCalls.push({method:'respond',sampleId:currentSample?.id,id,result:structuredClone(result)});};
  hub.on('event',event=>{if(event.type==='error')evidence.errors.push({phase:'hub',message:event.data?.message});if(win&&!win.isDestroyed())win.webContents.send('sunny:event',transport.event(event.type,event.data));});
  win=new BrowserWindow({title:'Sunny OFFLINE ordered control verification',width:1520,height:980,show:false,webPreferences:{preload:path.join(root,'desktop','preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
  ipcMain.handle('sunny:invoke',makeDispatch({getHub:()=>hub,getTransport:()=>transport,getWindow:()=>win,records:evidence.ipcCalls,onControl:async(action,args)=>{
   assert.ok(currentSample,'Control invocation requires a declared sample');assert.equal(action,currentSample.action);assert.equal(args.taskId||currentSample.taskId,currentSample.taskId);
   stopMainMonitors=startControlMonitors(currentSample);
   currentSample.handlerStartedAtMs=performance.now();currentSample.handlerTimer=oneMs(currentSample.mainTimers,'actual main handler');
   currentSample.backgroundTimer=oneMs(currentSample.mainTimers,'background Hub admission');const start=performance.now();
   currentSample.background=hub.persist(null).then(receipt=>{currentSample.backgroundReceipt=receipt;},error=>{currentSample.backgroundFailure=failure(error);});
   currentSample.backgroundAdmissionMs=performance.now()-start;
   await new Promise(resolve=>setImmediate(resolve));
   currentSample.pendingAtControlAdmission=hub.authorityQueue.active&&currentSample.nativeCheckpointPending===true;
   currentSample.controlAdmittedAtMs=performance.now();
   assert.ok(currentSample.pendingAtControlAdmission,'Background native checkpoint already settled: sample is not valid under load');
  },onControlSettled:()=>{stopMainMonitors?.();stopMainMonitors=null;if(currentSample)currentSample.mainHandlerAwaitedMs=performance.now()-currentSample.handlerStartedAtMs;}}));
  win.webContents.on('render-process-gone',(_event,details)=>{evidence.errors.push({phase:'renderer-gone',reason:details.reason});write();});
  await win.loadFile(path.join(root,'dist','index.html'));
  for(let n=0;n<100;n++){if(await win.webContents.executeJavaScript('Boolean(document.querySelector(".continuous-shell"))'))break;await pause(50);}
  check('built full App rendered',await win.webContents.executeJavaScript('Boolean(document.querySelector(".continuous-shell"))'));
  const prefs=win.webContents.getLastWebPreferences();check('renderer isolation enabled',prefs.contextIsolation&&prefs.sandbox&&!prefs.nodeIntegration,{contextIsolation:prefs.contextIsolation,sandbox:prefs.sandbox,nodeIntegration:prefs.nodeIntegration});
  check('renderer has no Node',await win.webContents.executeJavaScript('typeof require === "undefined" && typeof process === "undefined" && typeof window.sunny.invoke === "function"'));
  // Exercise all startup read actions through the actual preload/facade, outside timing.
  evidence.startupReads=await win.webContents.executeJavaScript(`(async()=>{const state=await window.sunny.invoke('snapshot');const task=state.taskSummaries[0],mission=state.missions[0];const page=await window.sunny.invoke('transcript:page',{projectId:task.projectId,taskId:task.id,epoch:state.epoch,revision:task.transcriptRevision,direction:'older'});const result=await window.sunny.invoke('mission:resultStatus',{projectId:mission.projectId,missionId:mission.id,revision:mission.revision});const workspace=await window.sunny.invoke('workspace:get',{});const files=await window.sunny.invoke('files:list',{projectId:task.projectId,path:''});const read=await window.sunny.invoke('files:read',{projectId:task.projectId,path:'fixture.txt'});return {protocolVersion:state.protocolVersion,pageSegments:page.segments.length,resultAvailable:result.available,drafts:workspace.drafts.length,files:files.length,readText:read.text};})()`);
  for(let n=0;n<SAMPLES;n++){const list=[];await oneMs(list,'idle timer control');evidence.timerControls.push(list[0].excessMs);}
  const controlTask={id:'offline-control',projectId:'synthetic-project',crewId:'franky',title:'SYNTHETIC isolated Stop/approval control',status:'finished',threadId:'offline-control-thread',createdAt:1,updatedAt:1,messages:[]};
  hub.state.tasks.push(controlTask);hub.emit('transcript:seed',controlTask);hub.markDirty();await hub.persist('mission');
  for(const action of evidence.method.controls)for(let index=-WARMUPS;index<SAMPLES;index++){
   await hub.authorityQueue.flush();
   delete controlTask.approvalResponseIntent;delete controlTask.error;Object.assign(controlTask,{status:action==='approval:respond'?'waiting':'working',turnId:'offline-turn-'+action+'-'+index,executionId:'offline-execution-'+action+'-'+index,updatedAt:Date.now()});
   hub.bumpTask(controlTask);hub.reserveWriter(controlTask);
   let args={taskId:controlTask.id},approval;
   if(action==='approval:respond'){
    approval=require('../desktop/approvals.cjs').createApproval({id:'offline-rpc-'+index,method:'item/commandExecution/requestApproval',params:{threadId:controlTask.threadId,turnId:controlTask.turnId,command:'SYNTHETIC no command runs'}},controlTask);
    hub.state.approvals.push(approval);args={id:approval.id,decision:index%2===0?'accept':'decline'};
   }
   hub.markDirty();await hub.persist('mission');hub.publishSnapshot();await pause(10);
   hub.state.tasks[0].messages.at(-1).text+='x'.repeat(64);hub.markDirty();
   const sample={id:action+':'+index,index,warmup:index<0,action,taskId:controlTask.id,decision:args.decision,mainTimers:[],timerPromises:[],mainContinuous1msExcessMs:[],heartbeatExcessMs:[],providerStart:evidence.providerCalls.length,submissionStart:evidence.submissions.length};
   currentSample=sample;
   try{sample.renderer=await win.webContents.executeJavaScript('('+rendererControl.toString()+')('+JSON.stringify(action)+','+JSON.stringify(args)+')');}
   catch(error){sample.rendererEvaluationFailure=failure(error);}
   sample.controlReturnAtMs=performance.now();stopMainMonitors?.();stopMainMonitors=null;
   await sample.background;await sample.backgroundTimer;await sample.handlerTimer;
   await hub.authorityQueue.flush();await Promise.all(sample.timerPromises);
   delete sample.background;delete sample.backgroundTimer;delete sample.handlerTimer;delete sample.timerPromises;
   sample.receipts=evidence.submissions.slice(sample.submissionStart).map(item=>({reason:item.reason,receipt:item.receipt,failure:item.failure,syncHandoffMs:item.syncHandoffMs,awaitedReceiptMs:item.awaitedReceiptMs}));
   const firstRequired=evidence.submissions.slice(sample.submissionStart).find(item=>item.reason!==null);
   sample.authorityQueueWaitToFirstRequiredSubmitMs=firstRequired?Math.max(0,firstRequired.startedAtMs-sample.controlAdmittedAtMs):null;
   sample.provider=evidence.providerCalls.slice(sample.providerStart);
   const receipt=hub.lastReceipt;
   try{
    sample.proof=await readonlyProof({file,expected:hub.savedProfile,receipt,taskId:controlTask.id},workers);
    assert.ok(sample.proof.exactWholeState&&sample.proof.receiptMatches,'Full compact state must match exact receipt and expected persisted image');
    assert.equal(sample.proof.missionStatus,'WAITING_FOR_REVIEW');
    assert.equal(sample.proof.fixtureTasks,evidence.fixture.initialTasks);
    assert.deepEqual(sample.proof.opaqueRoot,initial.opaqueRoot);assert.deepEqual(sample.proof.opaqueBook,initial.missionBook.opaqueBook);assert.deepEqual(sample.proof.opaqueProject,initial.projects[0].opaqueProject);assert.deepEqual(sample.proof.opaqueMission,initial.missionBook.missions[0].opaqueMission);
    if(action==='task:interrupt'){
     assert.equal(controlTask.status,'interrupted');assert.equal(sample.proof.task.status,'interrupted');assert.equal(hub.gate.active.has(controlTask.id),false);
     assert.equal(sample.provider.filter(call=>call.method==='turn/interrupt').length,1);sample.reservationReleased=true;
    }else{
     const intent=sample.proof.task.approvalResponseIntent;assert.equal(intent.state,'submitted');assert.equal(intent.approvalId,approval.id);assert.equal(intent.decision,args.decision);assert.equal(intent.threadId,controlTask.threadId);assert.equal(intent.turnId,controlTask.turnId);assert.equal(intent.executionId,controlTask.executionId);assert.ok(intent.submittedAt>=intent.createdAt);assert.deepEqual(intent.result,{decision:args.decision});
     const replies=sample.provider.filter(call=>call.method==='respond');assert.equal(replies.length,1);assert.equal(replies[0].id,approval.rpcId);assert.deepEqual(replies[0].result,intent.result);assert.equal(hub.state.approvals.some(item=>item.id===approval.id),false);assert.equal(controlTask.status,'working');assert.ok(hub.gate.active.has(controlTask.id));sample.approvalBoundAndSubmitted=true;
    }
    sample.semanticPass=true;
   }catch(error){sample.proofFailure=failure(error);sample.semanticPass=false;}
   sample.explicitFailureReply=explicitFailure(sample.renderer?.reply);
   const requiredReasons=action==='task:interrupt'?['reservation-release']:['dispatch','mission'];
   sample.requiredReceiptsPresent=requiredReasons.every(reason=>sample.receipts.some(item=>item.reason===reason&&item.receipt));
   sample.success=sample.renderer?.outcome==='fulfilled'&&!sample.explicitFailureReply&&!sample.rendererEvaluationFailure&&!sample.backgroundFailure&&sample.semanticPass&&sample.pendingAtControlAdmission&&sample.requiredReceiptsPresent&&sample.receipts.every(item=>item.receipt&&!item.failure);
   (sample.warmup?evidence.warmups:evidence.samples).push(sample);log('sample',sample);write();currentSample=null;
   // Finish the synthetic approval turn outside measurement before another sample.
   if(action==='approval:respond'){await hub.interrupt(controlTask.id);await hub.authorityQueue.flush();}
  }
  evidence.metrics=Object.fromEntries(evidence.method.controls.map(action=>{
   const records=evidence.samples.filter(sample=>sample.action===action);
   return [action,{count:records.length,failures:records.filter(sample=>!sample.success).length,rttMs:summarize(records.map(sample=>sample.renderer?.rttMs).filter(Number.isFinite)),mainHandlerAwaitedMs:summarize(records.map(sample=>sample.mainHandlerAwaitedMs).filter(Number.isFinite)),authorityQueueWaitToFirstRequiredSubmitMs:summarize(records.map(sample=>sample.authorityQueueWaitToFirstRequiredSubmitMs).filter(Number.isFinite)),mainContinuous1msExcessMs:summarize(records.flatMap(sample=>sample.mainContinuous1msExcessMs)),mainTimerExcessMs:summarize(records.flatMap(sample=>sample.mainTimers.map(timer=>timer.excessMs))),heartbeatExcessMs:summarize(records.flatMap(sample=>sample.heartbeatExcessMs)),mainSyncHandoffMs:summarize(records.flatMap(sample=>sample.receipts.map(item=>item.syncHandoffMs)))}];
  }));
  for(const [action,metrics] of Object.entries(evidence.metrics)){
   check(action+' all 20 raw controls completed',metrics.count===SAMPLES&&metrics.rttMs.count===SAMPLES&&metrics.failures===0,{count:metrics.count,failures:metrics.failures});
   check(action+' unchanged p95 RTT <200ms',metrics.rttMs.count===SAMPLES&&metrics.rttMs.p95<200,metrics.rttMs);
   check(action+' unchanged main 1ms timer excess <=100ms',metrics.mainContinuous1msExcessMs.max!==null&&metrics.mainContinuous1msExcessMs.max<=100&&metrics.mainTimerExcessMs.max!==null&&metrics.mainTimerExcessMs.max<=100,{continuous1ms:metrics.mainContinuous1msExcessMs,supplementaryOperationTimers:metrics.mainTimerExcessMs});
  }
  check('all mutated warmups succeeded',evidence.warmups.length===WARMUPS*2&&evidence.warmups.every(sample=>sample.success));
  await hub.close();const lastReceipt=hub.lastReceipt,expected=hub.savedProfile;hub=null;
  evidence.afterCloseProof=await readonlyProof({file,expected,receipt:lastReceipt,taskId:controlTask.id},workers);
  check('full transcript/draft/opaque state survives close/reopen',evidence.afterCloseProof.exactWholeState&&evidence.afterCloseProof.receiptMatches&&evidence.afterCloseProof.journalMode==='wal',evidence.afterCloseProof);
  const after=sourceProof();check('source/build frozen throughout process',after.sourceDigest===evidence.source.sourceDigest&&after.builtDigest===evidence.source.builtDigest,{sourceDigest:after.sourceDigest,builtDigest:after.builtDigest});
  check('no runtime errors',evidence.errors.length===0,{errors:evidence.errors});
  evidence.passed=evidence.assertions.every(item=>item.status==='pass');write();
 }catch(error){evidence.errors.push({phase:'run',...failure(error)});evidence.passed=false;write();}
 finally{await finalizeAndExit({cleanup,evidence,write,beforeExit:()=>{clearTimeout(watchdog);finished=true;console.log('SUNNY_ORDERED_CONTROL_RESULT '+JSON.stringify({sizeMiB:mib,passed:evidence.passed===true,output}));},exit:code=>app.exit(code)});}
}
if(isDirectEntry(process,require.main,module,__filename))run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={resolveControlInputs,parseSize,isDirectEntry,validateFrozenTextShape,summarize,explicitFailure,finalizeAndExit,startControlMonitors,rendererControl,makeDispatch,readonlyProof,READONLY_PROOF};
