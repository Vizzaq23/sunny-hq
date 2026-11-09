const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {Worker}=require('node:worker_threads');
const {captureProfile,sealProfileSnapshot,diffProfile,applyProfileUpdate}=require('./profile-snapshot.cjs');
const reasons=new Set(['workspace','dispatch','mission','check-intent','publication-intent','acceptance','reservation-release','cue','shutdown']);
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function failure(code,message,identity={}){return Object.assign(new Error(message),{code,...identity});}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function captureQueuedImage(base,image,generation){
 const proto=Object.getPrototypeOf(image);
 if(!ArrayBuffer.isView(image)&&proto!==Object.prototype&&proto!==null)throw Error('Unsupported profile object');
 const merged={...base};
 for(const key of Object.keys(image)){
  const descriptor=Object.getOwnPropertyDescriptor(image,key);
  if(!descriptor||!Object.hasOwn(descriptor,'value'))throw Error('Profile accessors are not supported');
  Object.defineProperty(merged,key,{value:descriptor.value,enumerable:true,writable:true,configurable:true});
 }
 // Capture only changed branches; apply owns and seals them before returning.
 return applyProfileUpdate(base,diffProfile(base,merged,{baseGeneration:generation}),{generation});
}
async function openOrderedStore(options){
 if(!options||!['sqlite','json'].includes(options.kind)||typeof options.file!=='string'||!path.isAbsolute(options.file)||typeof options.backupDir!=='string'||!path.isAbsolute(options.backupDir))throw Error('Invalid ordered storage options');
 const timeoutMs=options.timeoutMs===undefined?30000:options.timeoutMs;
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Invalid storage timeout');
 const observe=options.latencyProbe===true&&typeof options.observeCommit==='function'?options.observeCommit:null;
 const epoch=randomUUID(),ready=deferred(),idleWaiters=[];
 // A factory may throw before the await below is reached.
 ready.promise.catch(()=>{});
 let lastSubmitted,worker,current=null,waiting=null,sequence=0,lastReceipt=null,initial,recovery,durability,terminal=null,closing=false,closed=false,closeResult=null,closeAck=null,timer=null,termination=null;
 function stopTimer(){clearTimeout(timer);timer=null;}
 function terminate(){if(!termination)termination=Promise.resolve().then(()=>worker?.terminate()).catch(()=>{});return termination;}
 function settleIdle(){if(current||waiting)return;for(const waiter of idleWaiters.splice(0))terminal?waiter.reject(terminal):waiter.resolve(lastReceipt);}
 function fail(error){
  if(terminal||closed)return;terminal=error;stopTimer();ready.reject(error);
  if(current)current.reject(error);if(waiting)waiting.reject(error);current=null;waiting=null;
  if(closeAck)closeAck.reject(error);settleIdle();terminate();
 }
 function uncertain(message){return failure('COMMIT_UNCERTAIN','Storage outcome is uncertain: '+message,{epoch,sequence:current?.sequence});}
 function arm(stage){stopTimer();timer=setTimeout(()=>fail(current?uncertain(stage+' timed out'):failure('WORKER_TIMEOUT','Persistence worker '+stage+' timed out')),timeoutMs);}
 function send(message){try{worker.postMessage(message);}catch(error){fail(current?uncertain(error.message):error);}}
 function dispatch(entry){current=entry;entry.sequence=++sequence;arm('commit');try{const image={...lastSubmitted,...entry.image},update=diffProfile(lastSubmitted,image,{baseGeneration:entry.sequence-1});lastSubmitted=applyProfileUpdate(lastSubmitted,update,{generation:entry.sequence-1});send({type:'commit',epoch,sequence:entry.sequence,update,reason:entry.reason});entry.image=null;}catch(error){fail(uncertain(error.message));}}
 function onMessage(message){
  if(terminal||closed)return;
  if(!message||message.epoch!==epoch)return fail(current?uncertain('invalid worker receipt epoch'):failure('WORKER_PROTOCOL','Invalid worker epoch'));
  if(message.type==='ready'){
   if(initial!==undefined||current||closing)return fail(failure('WORKER_PROTOCOL','Duplicate persistence initialization'));
   initial=message.image;lastSubmitted=sealProfileSnapshot(captureProfile(initial));recovery=message.recovery;durability=message.durability?Object.freeze({...message.durability}):undefined;stopTimer();ready.resolve();return;
  }
  if(observe&&(message.type==='committed'||message.type==='failed')&&message.probe&&message.sequence===current?.sequence){try{observe({sequence:message.sequence,...message.probe});}catch{/* Observer cannot alter settlement. */}}
  if(message.type==='failed')return fail(current?failure(message.uncertain?'COMMIT_UNCERTAIN':'STORE_FAILED',message.error||'Persistence worker failed',{epoch,sequence:current.sequence}):failure('STORE_FAILED',message.error||'Persistence worker initialization failed'));
  if(message.type==='closed'){
   if(!closing||current||waiting||!closeAck)return fail(failure('WORKER_PROTOCOL','Unexpected persistence close'));
   stopTimer();closed=true;closeAck.resolve();return;
  }
  if(!current||message.sequence!==current.sequence)return fail(uncertain('invalid or stale worker receipt sequence'));
  if(message.type==='prepared'){
   if(current.stateSha256||!sha(message.stateSha256))return fail(uncertain('invalid prepared receipt hash'));
   current.stateSha256=message.stateSha256;return;
  }
  const receipt=message.receipt;
  if(message.type!=='committed'||!receipt||receipt.epoch!==epoch||receipt.sequence!==current.sequence||!current.stateSha256||receipt.stateSha256!==current.stateSha256||!Number.isFinite(receipt.durableAt)||receipt.durableAt<=0)return fail(uncertain('invalid committed receipt'));
  stopTimer();lastReceipt=Object.freeze({...receipt});const completed=current;current=null;completed.resolve(lastReceipt);
  if(waiting){const next=waiting;waiting=null;dispatch(next);}else settleIdle();
 }
 try{
  // Custom factories must retain native postMessage's synchronous clone contract.
  worker=(options.workerFactory||((file,settings)=>new Worker(file,settings)))(path.join(__dirname,'persistence-worker.cjs'),{workerData:{kind:options.kind,file:options.file,backupDir:options.backupDir,epoch,...(options.latencyProbe===true?{latencyProbe:true}:{})}});
  if(!worker||typeof worker.on!=='function'||typeof worker.postMessage!=='function'||typeof worker.terminate!=='function')throw Error('Persistence worker is unavailable');
  worker.on('message',onMessage);worker.on('error',error=>fail(current?uncertain(error.message):error));
  worker.on('exit',code=>{if(!closed&&!terminal)fail(current?uncertain('worker exited before receipt ('+code+')'):failure('WORKER_EXIT','Persistence worker exited before close ('+code+')'));});
  arm('initialization');await ready.promise;
 }catch(error){fail(error);await terminate();throw error;}
 function submit(image,reason){
  if(terminal)return Promise.reject(terminal);if(closing||closed)return Promise.reject(failure('STORE_CLOSED','Ordered store is closing'));
  if(reason!==null&&!reasons.has(reason))return Promise.reject(failure('INVALID_BARRIER','Invalid storage barrier reason'));
  if(waiting&&waiting.reason!==null)return Promise.reject(failure('STORE_SATURATED','Ordered storage waiting image is occupied by a required barrier'));
  // Capture primitive strings without copying their bytes; all objects are owned. Waiting images need
  // their own snapshot now because the caller can mutate before later dispatch.
  let captured;try{if(image===null||typeof image!=='object'||Array.isArray(image))throw Error('Invalid profile image');captured=current?captureQueuedImage(lastSubmitted,image,sequence):image;}catch(error){return Promise.reject(error);}
  const entry={...deferred(),image:captured,reason};
  if(waiting)waiting.reject(failure('CHECKPOINT_SUPERSEDED','Background checkpoint superseded before persistence'));
  if(current)waiting=entry;else dispatch(entry);return entry.promise;
 }
 function flush(){if(terminal)return Promise.reject(terminal);if(!current&&!waiting)return Promise.resolve(lastReceipt);const waiter=deferred();idleWaiters.push(waiter);return waiter.promise;}
 function close(){
  if(closeResult)return closeResult;closing=true;
  closeResult=(async()=>{try{await flush();if(closed)return;closeAck=deferred();arm('close');send({type:'close',epoch});await closeAck.promise;}finally{stopTimer();await terminate();}})();return closeResult;
 }
 return {get recovery(){return recovery;},get durability(){return durability;},load:()=>structuredClone(initial),checkpoint:image=>submit(image,null),barrier:(image,reason)=>submit(image,reason),flush,close};
}
module.exports={openOrderedStore};
