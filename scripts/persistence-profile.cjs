// Synthetic, disposable local profiling only. Never discovers a profile or provider.
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {spawnSync}=require('node:child_process');const {performance,monitorEventLoopDelay}=require('node:perf_hooks');
const {StateStore,SqliteStore}=require('../desktop/core.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function buildSyntheticState(mib){
 if(!Number.isFinite(mib)||mib<1||mib>30)throw Error('Synthetic state size must be 1-30 MiB');
 const state={projects:[{id:'synthetic-project',path:'C:/synthetic-fixture',name:'Synthetic fixture'}],tasks:[],settings:{reducedMotion:true},missionBook:{version:1,missions:[]},news:{items:[]},world:{},growth:{enabled:false,crew:{}},discussions:[]};
 let bytes=Buffer.byteLength(JSON.stringify(state));const target=mib*1024*1024;let index=0;
 while(bytes<target){const task={id:'synthetic-'+index,threadId:'synthetic-thread-'+index,turnId:'synthetic-turn-'+index,projectId:'synthetic-project',crewId:'franky',title:'Synthetic transcript '+index,status:'finished',createdAt:1,updatedAt:1,messages:Array.from({length:40},(_,i)=>({id:'synthetic-'+index+'-'+i,role:i%2?'assistant':'user',time:1,text:('SYNTHETIC fixture '+index+':'+i+' — deterministic transcript. ').padEnd(1024,'x')}))};state.tasks.push(task);bytes+=Buffer.byteLength(JSON.stringify(task))+1;index++;}
 return state;
}
function summarize(samples){const sorted=[...samples].sort((a,b)=>a-b);const pick=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];return {count:sorted.length,min:sorted[0],p50:pick(.5),p95:pick(.95),max:sorted.at(-1),mean:samples.reduce((sum,n)=>sum+n,0)/samples.length,over100ms:samples.filter(n=>n>100).length};}
function memory(){const usage=process.memoryUsage();return {rss:usage.rss,heapUsed:usage.heapUsed,external:usage.external,arrayBuffers:usage.arrayBuffers};}
function peakMemory(current,next){for(const key of Object.keys(current))current[key]=Math.max(current[key],next[key]);}
function diskBytes(dir){return Object.fromEntries(fs.readdirSync(dir).filter(name=>fs.statSync(path.join(dir,name)).isFile()).map(name=>[name,fs.statSync(path.join(dir,name)).size]));}
async function timedBlocking(operation){const scheduledAt=performance.now();const timer=new Promise(resolve=>setTimeout(()=>resolve(Math.max(0,performance.now()-scheduledAt-1)),1));const started=performance.now();operation();const wallMs=performance.now()-started;return {wallMs,timerDelayMs:await timer};}
async function storeProfile({size,kind,samples}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-persist-profile-'));let store;
 try{const state=buildSyntheticState(size);const bytesBefore=Buffer.byteLength(JSON.stringify(state));const prettyBytesBefore=Buffer.byteLength(JSON.stringify(state,null,2));const taskCount=state.tasks.length;let output;
  if(kind.startsWith('json'))store=new StateStore(path.join(dir,'state.json'));if(kind.startsWith('sqlite'))store=new SqliteStore(path.join(dir,'state.sqlite'));
  let prepared;
  const prepare=()=>{if(kind.endsWith('write-only'))prepared=JSON.stringify(state,null,kind.startsWith('json')?2:undefined);};
  const operation=()=>{if(kind==='serialize-compact')output=JSON.stringify(state);else if(kind==='serialize-pretty')output=JSON.stringify(state,null,2);else if(kind==='json-write-only'){const temp=store.file+'.'+process.pid+'.tmp';fs.writeFileSync(temp,prepared,'utf8');fs.renameSync(temp,store.file);}else if(kind==='sqlite-write-only')store.db.prepare('INSERT INTO state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(prepared);else store.save(state);};
  const mutate=()=>{state.tasks[0].messages.at(-1).text+=' SYNTHETIC '+'.'.repeat(53);};
  for(let i=0;i<3;i++){mutate();prepare();operation();await pause(5);}output=null;prepared=null;if(global.gc)global.gc();
  const timerControl=[];for(let i=0;i<40;i++)timerControl.push((await timedBlocking(()=>{})).timerDelayMs);
  const baselineMemory=memory(),peak=memory(),records=[];const monitor=monitorEventLoopDelay({resolution:1});monitor.enable();await pause(20);
  for(let i=0;i<samples;i++){mutate();prepare();records.push(await timedBlocking(operation));peakMemory(peak,memory());output=null;prepared=null;await pause(2);}
  await pause(20);monitor.disable();const result={sizeMiB:size,kind,samples,warmups:3,taskCount,messagesPerTask:40,textCharactersPerInitialMessage:1024,mutations:'append 64 ASCII characters to newest task after each warmup/sample; initial text is 1024 characters / 1026 UTF-8 bytes, including U+2014 (code point 8212)',compactBytesBefore:bytesBefore,compactBytesAfter:Buffer.byteLength(JSON.stringify(state)),prettyBytesBefore,wallMs:summarize(records.map(record=>record.wallMs)),timerDelayMs:summarize(records.map(record=>record.timerDelayMs)),eventLoopMonitorMs:{resolution:1,min:monitor.min/1e6,p50:monitor.percentile(50)/1e6,p95:monitor.percentile(95)/1e6,max:monitor.max/1e6},memoryBytes:{baseline:baselineMemory,peak,after:memory()},diskBytesBeforeClose:diskBytes(dir),records};
  result.timerControlDelayMs=summarize(timerControl);
  if(store instanceof SqliteStore){result.sqliteVersion=store.db.prepare('SELECT sqlite_version() AS version').get().version;result.sqlitePragmas=Object.fromEntries(['journal_mode','synchronous','page_size','wal_autocheckpoint'].map(key=>[key,Object.values(store.db.prepare('PRAGMA '+key).get())[0]]));}
  return result;
 }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
}
async function hubProfile({size,kind,failure=false}){
 const {Hub}=require('../desktop/hub.cjs');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-hub-profile-'));let hub,store,blockFile;
 try{const state=buildSyntheticState(size);state.projects[0].path=dir;state.tasks[0].status='working';store=kind==='sqlite'?new SqliteStore(path.join(dir,'state.sqlite')):new StateStore(path.join(dir,'state.json'));store.save(state);
  const started=performance.now(),writes=[],errors=[],eventTimes=[],delays=[];let inputCount=0,providerRequests=0;
  hub=new Hub({home:dir,store:{load:()=>state,save(value){const start=performance.now();let success=false;try{if(kind!=='noop-control')store.save(value);success=true;}finally{writes.push({atMs:start-started,wallMs:performance.now()-start,success});}},close:()=>store.close()},catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]}});
  hub.on('event',event=>{if(event.type==='error')errors.push({atMs:performance.now()-started});if(event.type==='task')eventTimes.push(performance.now()-started);});hub.client.request=async()=>{providerRequests++;throw Error('No provider work allowed in profile');};
  const task=hub.state.tasks[0];task.status='working';let last=performance.now();const heartbeat=setInterval(()=>{const now=performance.now();delays.push(Math.max(0,now-last-5));last=now;},5);
  if(failure){if(kind==='sqlite')store.db.exec('PRAGMA query_only=ON');else{blockFile=store.file+'.'+process.pid+'.tmp';fs.mkdirSync(blockFile);}
   hub.streamChanged(task);await pause(350);task.messages.at(-1).text+=' SYNTHETIC idle latest value';
   while(writes.filter(write=>!write.success).length<3&&performance.now()-started<9000)await pause(20);
   if(kind==='sqlite')store.db.exec('PRAGMA query_only=OFF');else{fs.rmdirSync(blockFile);blockFile=null;}
   while(!writes.some(write=>write.success)&&performance.now()-started<13000)await pause(20);
  }else{const input=setInterval(()=>{inputCount++;hub.notification({method:'item/agentMessage/delta',params:{threadId:task.threadId,itemId:task.messages.at(-1).id,delta:' SYNTHETIC '+'.'.repeat(53)}});},20);await pause(5000);clearInterval(input);await pause(1300);}
  clearInterval(heartbeat);const beforeClose={sizeMiB:size,kind,mode:failure?'forced-store-failure-idle-backoff':'continuous-stream',durationMs:performance.now()-started,inputCount,taskEventCount:eventTimes.length,eventTimesMs:[...eventTimes],writes:structuredClone(writes),writeWallMs:summarize(writes.map(write=>write.wallMs)),saveIntervalMs:writes.length>1?summarize(writes.slice(1).map((write,i)=>write.atMs-writes[i].atMs)):null,heartbeatDelayMs:summarize(delays),errors,latestFixtureTextPersisted:store.load().tasks[0].messages.at(-1).text===task.messages.at(-1).text,providerRequests,memoryBytes:memory()};const beforeCloseWrites=writes.length;hub.close();beforeClose.shutdownWrites=writes.slice(beforeCloseWrites);hub=null;return beforeClose;
 }finally{if(blockFile)fs.rmdirSync(blockFile);hub?.close();if(!hub)try{store?.close();}catch{}fs.rmSync(dir,{recursive:true,force:true});}
}
async function main(){const args=process.argv.slice(2);if(args[0]==='--worker'){const config=JSON.parse(args[1]);const result=config.mode==='hub'?await hubProfile(config):await storeProfile(config);process.stdout.write(JSON.stringify(result));return;}
 const out=args[0]||path.join(os.tmpdir(),'sunny-persistence-profile-'+Date.now()+'.json');const samples=40;const report={capturedAt:new Date().toISOString(),synthetic:true,context:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,cpuLogicalCount:os.cpus().length,totalMemoryBytes:os.totalmem(),tempStorage:'Windows temporary directory on current host; warm filesystem/cache; no provider/profile reads'},method:{samplesPerStoreCase:samples,warmups:3,latencyBudgetMs:100,percentile:'nearest-rank',workerIsolation:'fresh Node process per size/kind; one GC before measured batch',timerDelay:'1ms timer scheduled immediately before synchronous operation; overdue deadline measured after it returns',memory:'process.memoryUsage snapshots after each sample; allocation peak inside operation may be higher'},stores:[],hub:[]};
 for(const size of [1,10,30])for(const kind of ['serialize-compact','serialize-pretty','json','json-write-only','sqlite','sqlite-write-only']){const config={size,kind,samples};const run=spawnSync(process.execPath,['--expose-gc',__filename,'--worker',JSON.stringify(config)],{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:4*1024*1024});if(run.status!==0)throw Error('Worker failed '+JSON.stringify(config)+': '+run.stderr);const result=JSON.parse(run.stdout);report.stores.push(result);console.log(JSON.stringify({size,kind,bytes:result.compactBytesBefore,wallMs:result.wallMs,timerDelayMs:result.timerDelayMs,timerControlDelayMs:result.timerControlDelayMs}));fs.writeFileSync(out,JSON.stringify(report,null,2));}
 for(const size of [10,30])for(const kind of ['json','sqlite'])for(const failure of [false,true]){const config={mode:'hub',size,kind,failure};const run=spawnSync(process.execPath,['--expose-gc',__filename,'--worker',JSON.stringify(config)],{encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:4*1024*1024});if(run.status!==0)throw Error('Hub worker failed '+JSON.stringify(config)+': '+run.stderr);const result=JSON.parse(run.stdout);report.hub.push(result);console.log(JSON.stringify({size,kind,mode:result.mode,writes:result.writes,latestFixtureTextPersisted:result.latestFixtureTextPersisted,heartbeatDelayMs:result.heartbeatDelayMs}));fs.writeFileSync(out,JSON.stringify(report,null,2));}
 for(const size of [10,30]){const config={mode:'hub',size,kind:'noop-control'};const run=spawnSync(process.execPath,['--expose-gc',__filename,'--worker',JSON.stringify(config)],{encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:4*1024*1024});if(run.status!==0)throw Error('Hub control failed '+JSON.stringify(config)+': '+run.stderr);report.hub.push(JSON.parse(run.stdout));fs.writeFileSync(out,JSON.stringify(report,null,2));}
 console.log('PROFILE_RESULT '+out);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={buildSyntheticState,summarize};
