const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {Worker}=require('node:worker_threads');
const {EventEmitter}=require('node:events');
const {openOrderedStore}=require('../desktop/ordered-store.cjs');
const {emptyWorkspace}=require('../desktop/mission-profile.cjs');
const image=text=>({projects:[],tasks:[{id:'task',messages:[{id:'reply',text}]}],opaque:{nested:{text:'\u822a\u6d77 \ud83d\udc33'}},missionBook:{version:2,missions:[],workspace:emptyWorkspace()}});
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fixture(t,kind='sqlite'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-capture-')),workers=[],stores=[];
 t.after(async()=>{await Promise.allSettled(workers.map(worker=>worker.terminate()));await Promise.allSettled(stores.map(store=>store.close()));fs.rmSync(dir,{recursive:true,force:true});});
 const factory=(file,options)=>{const worker=new Worker(file,options);workers.push(worker);return worker;};
 return {workers,stores,options:{kind,file:path.join(dir,kind==='sqlite'?'state.sqlite':'state.json'),backupDir:path.join(dir,'backups'),workerFactory:factory}};
}
async function open(f,extra={}){const store=await openOrderedStore({...f.options,...extra});f.stores.push(store);return store;}
function gate(f,{throwSequence,forwardBeforeThrow=false}={}){
 let release,held;const committed=new Promise(resolve=>{release=resolve;});let bridge;
 const sent=[];
 const factory=(file,options)=>{
  const worker=new Worker(file,options);f.workers.push(worker);bridge=new EventEmitter();
  // Forward immediately through the actual native synchronous clone. The bridge
  // retains only command metadata and never retains or simulates a full image.
  bridge.postMessage=message=>{
   sent.push({type:message.type,sequence:message.sequence});
   if(message.type==='commit'&&message.sequence===throwSequence){if(forwardBeforeThrow)worker.postMessage(message);throw Error('fixture postMessage failure');}
   worker.postMessage(message);
  };bridge.terminate=()=>worker.terminate();
  worker.on('message',message=>{if(message.type==='committed'&&held===undefined){held=message;release();return;}bridge.emit('message',message);});
  worker.on('error',error=>bridge.emit('error',error));worker.on('exit',code=>bridge.emit('exit',code));return bridge;
 };
 return {factory,committed,sent,release(){const message=held;held=null;bridge.emit('message',message);}};
}
for(const kind of ['sqlite','json'])test('native_idle_submission_captures_before_caller_mutation '+kind,{timeout:15000},async t=>{
 const f=fixture(t,kind),store=await open(f),submitted=image('idle captured'),expected=structuredClone(submitted);
 const pending=store.barrier(submitted,'dispatch');submitted.tasks[0].messages[0].text='caller changed';submitted.opaque.nested.text='caller opaque change';submitted.missionBook.workspace.revision=9;
 assert.equal((await pending).stateSha256,digest(expected));await store.close();assert.deepEqual((await open(f)).load(),expected);
});
test('idle_native_capture_avoids_extra_main_clone_while_waiting_image_is_owned',{timeout:15000},async t=>{
 const f=fixture(t),held=gate(f),store=await open(f,{workerFactory:held.factory}),firstImage=image('first'),waitingImage=image('waiting'),firstExpected=structuredClone(firstImage),waitingExpected=structuredClone(waitingImage);
 const nativeClone=global.structuredClone;let clones=0,idleClones,totalClones,first,waiting;
 try{
  global.structuredClone=(...args)=>{clones++;return nativeClone(...args);};
  first=store.barrier(firstImage,'dispatch');idleClones=clones;
  waiting=store.barrier(waitingImage,'mission');totalClones=clones;
 }finally{global.structuredClone=nativeClone;}
 firstImage.tasks[0].messages[0].text='idle mutation';waitingImage.tasks[0].messages[0].text='waiting mutation';waitingImage.opaque.nested.text='waiting opaque mutation';
 await held.committed;held.release();const [firstReceipt,waitingReceipt]=await Promise.all([first,waiting]);
 assert.equal(firstReceipt.stateSha256,digest(firstExpected));assert.equal(waitingReceipt.stateSha256,digest(waitingExpected));await store.close();assert.deepEqual((await open(f)).load(),waitingExpected);
 assert.equal(idleClones,0,'real postMessage already captures an idle submission');assert.equal(totalClones,1,'only waiting images require an additional main-owned capture');
});
test('owned_waiting_images_coalesce_without_losing_required_barriers',{timeout:15000},async t=>{
 const f=fixture(t),held=gate(f),store=await open(f,{workerFactory:held.factory}),initial=image('initial'),initialExpected=structuredClone(initial),first=store.barrier(initial,'dispatch');initial.tasks[0].messages[0].text='initial mutation';await held.committed;
 const old=store.checkpoint(image('old')),latest=store.checkpoint(image('latest'));await assert.rejects(old,error=>error.code==='CHECKPOINT_SUPERSEDED');
 const required=image('required'),requiredExpected=structuredClone(required),barrier=store.barrier(required,'cue');required.tasks[0].messages[0].text='required mutation';required.opaque.nested.text='required opaque mutation';await assert.rejects(latest,error=>error.code==='CHECKPOINT_SUPERSEDED');
 await assert.rejects(store.barrier(image('blocked'),'mission'),error=>error.code==='STORE_SATURATED');await assert.rejects(store.checkpoint(image('blocked checkpoint')),error=>error.code==='STORE_SATURATED');
 held.release();assert.equal((await first).stateSha256,digest(initialExpected));assert.equal((await barrier).stateSha256,digest(requiredExpected));
 const newest=image('newest'),newestExpected=structuredClone(newest),final=store.checkpoint(newest);newest.tasks[0].messages[0].text='newest mutation';assert.equal((await final).stateSha256,digest(newestExpected));await store.close();assert.deepEqual((await open(f)).load(),newestExpected);
 assert.deepEqual(held.sent.filter(message=>message.type==='commit').map(message=>message.sequence),[1,2,3]);
});
test('failed_waiting_capture_does_not_replace_accepted_checkpoint',{timeout:15000},async t=>{
 const f=fixture(t),held=gate(f),store=await open(f,{workerFactory:held.factory}),first=store.barrier(image('first'),'dispatch');await held.committed;
 const saved=image('retained waiting'),expected=structuredClone(saved),waiting=store.checkpoint(saved);saved.tasks[0].messages[0].text='caller changed waiting';
 await assert.rejects(store.barrier({...image('invalid'),nonCloneable:()=>{}},'mission'),error=>error.name==='DataCloneError');
 held.release();await first;assert.equal((await waiting).stateSha256,digest(expected));await store.close();assert.deepEqual((await open(f)).load(),expected);
});
test('queued_postMessage_failure_rejects_pending_flush_and_reports_uncertainty',{timeout:15000},async t=>{
 const f=fixture(t),held=gate(f,{throwSequence:2}),store=await open(f,{workerFactory:held.factory}),saved=image('durable first'),first=store.barrier(saved,'dispatch');await held.committed;
 const second=store.barrier(image('not sent'),'mission'),flushing=store.flush();const failedSecond=assert.rejects(second,error=>error.code==='COMMIT_UNCERTAIN'&&error.sequence===2&&typeof error.epoch==='string');const failedFlush=assert.rejects(flushing,error=>error.code==='COMMIT_UNCERTAIN');
 held.release();assert.equal((await first).stateSha256,digest(saved));await Promise.all([failedSecond,failedFlush]);await assert.rejects(store.close(),/postMessage failure/);assert.deepEqual((await open(f)).load(),saved);
});
test('native_postMessage_forward_then_throw_never_claims_a_durable_receipt',{timeout:15000},async t=>{
 const f=fixture(t),held=gate(f,{throwSequence:1,forwardBeforeThrow:true}),store=await open(f,{workerFactory:held.factory}),saved=image('potentially committed');
 await assert.rejects(store.barrier(saved,'dispatch'),error=>error.code==='COMMIT_UNCERTAIN'&&error.sequence===1);await assert.rejects(store.flush(),/postMessage failure/);await assert.rejects(store.close(),/postMessage failure/);
 // Termination can race the already forwarded commit. Either exact outcome is
 // valid; neither can be acknowledged as durable without the missing receipt.
 const reopened=(await open(f)).load();assert.ok(Object.keys(reopened).length===0||digest(reopened)===digest(saved));
});
