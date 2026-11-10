const fs=require('node:fs');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {parentPort,workerData,isMainThread}=require('node:worker_threads');
const {StateStore,prepareWorkerSqliteStore}=require('./core.cjs');
const {inspectMissionProfile,prepareWorkerMissionProfileStore}=require('./mission-profile.cjs');
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
 const writeCompact=compact=>{
  if(typeof compact!=='string')throw TypeError('Compact profile must be a string');
  const temporary=file+'.'+randomUUID()+'.tmp';let descriptor;
  try{descriptor=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(descriptor,compact,'utf8');fs.fsyncSync(descriptor);fs.closeSync(descriptor);descriptor=undefined;fs.renameSync(temporary,file);syncDirectory(path.dirname(file));}
  finally{if(descriptor!==undefined)fs.closeSync(descriptor);if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 };raw.save=value=>writeCompact(JSON.stringify(value));return {raw,writeCompact};
}
if(isMainThread||!parentPort)throw Error('Profile persistence must run in its worker');
const {captureProfile,sealProfileSnapshot,applyProfileUpdate}=require('./profile-snapshot.cjs');
const {epoch}=workerData;let raw,store,durability,current,lastSequence=0,ended=false;
function post(message){parentPort.postMessage({epoch,...message});}
function finish(){if(ended)return;ended=true;try{store?store.close():raw?.close();}finally{parentPort.close();}}
async function boot(){
 try{
  preflightExistingProfile(workerData.kind,workerData.file);
  if(workerData.kind==='sqlite'){
   raw=await require('./fragment-store.cjs').openFragmentStore({file:workerData.file,backupDir:path.join(workerData.backupDir,'storage-format'),latencyProbe:workerData.latencyProbe===true});durability=raw.durability;
   const initialized=require('./mission-profile.cjs').initializeMissionProfileStore(raw,workerData.backupDir);let receipt=initialized.receipt;
   store={load:()=>captureProfile(initialized.current),prepareOwned(candidate){if(receipt)require('./mission-profile.cjs').upgradeMissionProfile(initialized.saved,receipt);const prepared=raw.prepare(candidate);return {stateSha256:prepared.stateSha256,commit(){const timing=prepared.commit();receipt=null;return timing;}};},close:()=>raw.close()};
  }else if(workerData.kind==='json'){const backend=durableJsonStore(workerData.file);raw=backend.raw;store=prepareWorkerMissionProfileStore(raw,workerData.backupDir,backend.writeCompact);}else throw Error('Invalid persistence storage kind');
  current=sealProfileSnapshot(captureProfile(store.load()));
  post({type:'ready',image:current,recovery:store.recovery,durability,runtime:{electron:process.versions.electron,node:process.versions.node,executable:process.execPath,threadId:require('node:worker_threads').threadId,entry:__filename}});
 }catch(error){post({type:'failed',error:error.message,uncertain:false});finish();}
}
parentPort.on('message',message=>{
 if(ended)return;let writeStarted=false;
 const probe=workerData.latencyProbe===true?{}:null,started=probe?performance.now():0;
 try{
  if(!message||message.epoch!==epoch)throw Error('Invalid private persistence epoch');
  if(message.type==='close'){store.close();store=null;raw=null;post({type:'closed'});finish();return;}
  if(message.type!=='commit'||!Number.isSafeInteger(message.sequence)||message.sequence!==lastSequence+1)throw Error('Invalid private persistence sequence');
  const candidate=applyProfileUpdate(current,message.update,{generation:lastSequence});
  if(candidate===null||typeof candidate!=='object'||Array.isArray(candidate))throw Error('Invalid submitted profile image');
  if(inspectMissionProfile(candidate).mode!=='v3')throw Error('Unsupported or invalid mission profile. Preserve the saved data for recovery and use a compatible Sunny version.');
  const prepared=store.prepareOwned(candidate),stateSha256=prepared.stateSha256||createHash('sha256').update(prepared.compact).digest('hex');
  if(probe)probe.prepareMs=performance.now()-started;
  post({type:'prepared',sequence:message.sequence,stateSha256});writeStarted=true;const storageTiming=prepared.commit();if(probe&&storageTiming)probe.storage=storageTiming;current=candidate;lastSequence=message.sequence;
  if(probe)probe.commitMs=performance.now()-started-probe.prepareMs;
  post({type:'committed',sequence:lastSequence,receipt:{epoch,sequence:lastSequence,stateSha256,durableAt:Date.now()},...(probe?{probe}:{})});
 }catch(error){post({type:'failed',sequence:message?.sequence,error:error.message,uncertain:writeStarted});finish();}
});
void boot();
