const {performance}=require('node:perf_hooks');
const fs=require('node:fs');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {parentPort,workerData,isMainThread}=require('node:worker_threads');
const {StateStore,SqliteStore}=require('./core.cjs');
const {inspectMissionProfile,prepareMissionProfileStore}=require('./mission-profile.cjs');
function preflightExistingProfile(kind,file){
 if(!fs.existsSync(file))return;
 let saved;
 try{
  if(kind==='json')saved=JSON.parse(fs.readFileSync(file,'utf8'));
  else if(kind==='sqlite'){
   const {DatabaseSync}=require('node:sqlite'),database=new DatabaseSync(file,{readOnly:true});
   try{const row=database.prepare('SELECT value FROM state WHERE id=1').get();saved=row?JSON.parse(row.value):{};}finally{database.close();}
  }else throw Error('Invalid storage format.');
  if(!['empty','v1-upgrade','v2-upgrade','v3'].includes(inspectMissionProfile(saved).mode))throw Error('Unsupported mission profile.');
 }catch(error){throw Error('Saved Sunny profile is unreadable or unsupported. Preserve the original file and use a compatible copy for recovery. '+error.message);}
}
function syncDirectory(directory){
 // Windows does not expose directory fsync via Node. File fsync and an atomic
 // same-directory rename remain mandatory; POSIX also fsyncs the directory.
 if(process.platform==='win32')return;
 const descriptor=fs.openSync(directory,'r');try{fs.fsyncSync(descriptor);}finally{fs.closeSync(descriptor);}
}
function durableJsonStore(file){
 const raw=new StateStore(file);
 raw.save=value=>{
  const temporary=file+'.'+randomUUID()+'.tmp';let descriptor;
  try{descriptor=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(descriptor,JSON.stringify(value),'utf8');fs.fsyncSync(descriptor);fs.closeSync(descriptor);descriptor=undefined;fs.renameSync(temporary,file);syncDirectory(path.dirname(file));}
  finally{if(descriptor!==undefined)fs.closeSync(descriptor);if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 };return raw;
}
if(isMainThread||!parentPort)throw Error('Profile persistence must run in its worker');
const {epoch}=workerData;let raw,store,lastSequence=0,ended=false;
function post(message){parentPort.postMessage({epoch,...message});}
function finish(){if(ended)return;ended=true;try{store?store.close():raw?.close();}finally{parentPort.close();}}
try{
 // Read before opening any writer: WAL setup and CREATE TABLE can change a
 // foreign/unsupported SQLite file even when subsequent authority checks fail.
 // Malformed JSON must not enter StateStore's historical defaults fallback.
 preflightExistingProfile(workerData.kind,workerData.file);
 raw=workerData.kind==='sqlite'?new SqliteStore(workerData.file):workerData.kind==='json'?durableJsonStore(workerData.file):null;
 if(!raw)throw Error('Invalid persistence storage kind');
 if(workerData.kind==='sqlite'){
  raw.db.exec('PRAGMA synchronous=FULL');
  if(raw.db.prepare('PRAGMA journal_mode').get().journal_mode!=='wal'||raw.db.prepare('PRAGMA synchronous').get().synchronous!==2)throw Error('SQLite WAL/FULL durability is required');
 }
 store=prepareMissionProfileStore(raw,workerData.backupDir);
 post({type:'ready',image:store.load(),recovery:store.recovery});
}catch(error){post({type:'failed',error:error.message,uncertain:false});finish();}
parentPort.on('message',message=>{
 if(ended)return;let writeStarted=false;const probe=workerData.latencyProbe===true&&message?.type==='commit'?{loadMerge:0,validation:0,stringify:0,parse:0,revalidation:0,hash:0,adapterSave:0,total:0,stage:0,failed:0,adapterCloneMerge:0,adapterValidation:0,adapterRawSave:0,adapterBookkeeping:0,adapterTotal:0,adapterStage:0,adapterFailed:0,sqlPrepare:0,sqlStringify:0,sqlRun:0,sqlTotal:0,sqlStage:0,sqlFailed:0}:null;let tick=probe?performance.now():0;const started=tick;function mark(key,stage){if(probe){const now=performance.now();probe[key]=now-tick;tick=now;probe.stage=stage;}}
 try{
  if(!message||message.epoch!==epoch)throw Error('Invalid private persistence epoch');
  if(message.type==='close'){store.close();store=null;raw=null;post({type:'closed'});finish();return;}
  if(message.type!=='commit'||!Number.isSafeInteger(message.sequence)||message.sequence!==lastSequence+1)throw Error('Invalid private persistence sequence');
  if(message.image===null||typeof message.image!=='object'||Array.isArray(message.image))throw Error('Invalid submitted profile image');
  const merged={...store.load(),...message.image};mark('loadMerge',1);
  if(inspectMissionProfile(merged).mode!=='v3')throw Error('Unsupported or invalid mission profile. Preserve the saved data for recovery.');
  mark('validation',2);
  // Validation precedes serialization so sparse authority arrays cannot acquire
  // validity through JSON conversion. The receipt hashes actual compact bytes.
  const compact=JSON.stringify(merged);mark('stringify',3);const normalized=JSON.parse(compact);mark('parse',4);
  if(inspectMissionProfile(normalized).mode!=='v3')throw Error('Invalid serialized mission profile');
  mark('revalidation',5);
  const stateSha256=createHash('sha256').update(compact).digest('hex');
  mark('hash',6);
  post({type:'prepared',sequence:message.sequence,stateSha256});writeStarted=true;if(probe)tick=performance.now();
  // Preserve explicit undefined overrides through the adapter's opaque merge.
  // Passing normalized here would restore omitted old fields after hashing.
  if(probe)store.save(merged,probe);else store.save(merged);mark('adapterSave',7);lastSequence=message.sequence;if(probe)probe.total=performance.now()-started;
  post({type:'committed',sequence:lastSequence,...(probe?{probe}:{}),receipt:{epoch,sequence:lastSequence,stateSha256,durableAt:Date.now()}});
 }catch(error){if(probe){probe.failed=1;probe.total=performance.now()-started;}post({type:'failed',...(probe?{probe}:{}),sequence:message?.sequence,error:error.message,uncertain:writeStarted});finish();}
});
