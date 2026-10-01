const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {Worker}=require('node:worker_threads');
const {EventEmitter}=require('node:events');
const source=path.join(__dirname,'../desktop/ordered-store.cjs');
const api=fs.existsSync(source)?require(source):{};
const {emptyWorkspace}=require('../desktop/mission-profile.cjs');
const image=(text='航海 🏴‍☠️ café')=>({projects:[],tasks:[{id:'t',messages:[{id:'msg',text}]}],opaque:{retained:'未来 🐳'},missionBook:{version:2,missions:[],workspace:emptyWorkspace()}});
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fixture(t,kind='sqlite'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-ordered-'));const stores=[],workers=[];
 t.after(async()=>{await Promise.allSettled(stores.map(store=>store.close()));await Promise.allSettled(workers.map(worker=>worker.terminate()));fs.rmSync(dir,{recursive:true,force:true});});
 return {dir,options:{kind,file:path.join(dir,kind==='sqlite'?'state.sqlite':'state.json'),backupDir:path.join(dir,'backups')},stores,workers};
}
async function open(f,extra={}){assert.equal(typeof api.openOrderedStore,'function','ordered store API must exist');const store=await api.openOrderedStore({...f.options,...extra});f.stores.push(store);return store;}
function gateFactory(f,{die=false,forge=false}={}){
 let release;const seen=[];const committed=new Promise(resolve=>{release=resolve;});let held;
 const factory=(file,options)=>{
  const worker=new Worker(file,options);f.workers.push(worker);const bridge=new EventEmitter();
  bridge.postMessage=message=>{seen.push(structuredClone(message));worker.postMessage(message);};bridge.terminate=()=>worker.terminate();
  worker.on('message',message=>{
   if(message.type==='committed'&&!held){held=message;release(message);if(die)worker.terminate();else if(forge)bridge.emit('message',{...message,receipt:{...message.receipt,...forge}});return;}
   bridge.emit('message',message);
  });worker.on('error',error=>bridge.emit('error',error));worker.on('exit',code=>bridge.emit('exit',code));
  factory.release=()=>{const message=held;held=true;bridge.emit('message',message);};return bridge;
 };
 return {factory,committed,seen,release:()=>factory.release()};
}
for(const kind of ['sqlite','json']){
 test('barriers_are_ordered_and_receipts_match_exact_images '+kind,{timeout:15000},async t=>{
  const f=fixture(t,kind),store=await open(f),first=image('first 🐳'),second=image('second 航海');
  const p1=store.barrier(first,'dispatch'),p2=store.barrier(second,'acceptance');const [r1,r2]=await Promise.all([p1,p2]);
  assert.equal(r1.stateSha256,digest(first));assert.equal(r2.stateSha256,digest(second));assert.equal(r1.epoch,r2.epoch);assert.ok(r2.sequence>r1.sequence);assert.ok(r1.durableAt>0);assert.ok(r2.durableAt>=r1.durableAt);
  assert.deepEqual(await store.flush(),r2);await store.close();const reopened=await open(f);assert.deepEqual(reopened.load(),second);
 });
 test('opaque_unicode_profile_and_backup_receipt_roundtrip '+kind,{timeout:15000},async t=>{
  const f=fixture(t,kind),saved=image();saved.missionBook={version:1,missions:[],extra:{unicode:'古い 🐳'}};
  if(kind==='json')fs.writeFileSync(f.options.file,JSON.stringify(saved));else {const {SqliteStore}=require('../desktop/core.cjs');const raw=new SqliteStore(f.options.file);raw.save(saved);raw.close();}
  const store=await open(f),loaded=store.load();assert.equal(loaded.missionBook.version,2);assert.deepEqual(loaded.opaque,saved.opaque);assert.deepEqual(loaded.tasks,saved.tasks);
  const backup=path.join(f.options.backupDir,fs.readdirSync(f.options.backupDir)[0]);assert.deepEqual(JSON.parse(fs.readFileSync(backup)),saved);
  fs.appendFileSync(backup,'tamper');await assert.rejects(store.barrier(loaded,'workspace'),/backup|receipt/i);await assert.rejects(store.close(),/backup|receipt/i);
  const original=kind==='json'?JSON.parse(fs.readFileSync(f.options.file)):(()=>{const {SqliteStore}=require('../desktop/core.cjs');const raw=new SqliteStore(f.options.file);try{return raw.load();}finally{raw.close();}})();assert.deepEqual(original,saved);
 });
}
test('background_coalescing_preserves_required_barriers',{timeout:15000},async t=>{
 const f=fixture(t),gate=gateFactory(f),store=await open(f,{workerFactory:gate.factory});
 const first=store.checkpoint(image('first'));await gate.committed;
 const older=store.checkpoint(image('older')),latest=store.checkpoint(image('latest'));
 await assert.rejects(older,error=>error.code==='CHECKPOINT_SUPERSEDED');
 const barrier=store.barrier(image('required'),'mission');await assert.rejects(latest,error=>error.code==='CHECKPOINT_SUPERSEDED');
 await assert.rejects(store.barrier(image('overflow'),'cue'),error=>error.code==='STORE_SATURATED');
 gate.release();await first;const receipt=await barrier;assert.equal(receipt.stateSha256,digest(image('required')));
 await store.checkpoint(image('newest'));await store.close();assert.deepEqual((await open(f)).load(),image('newest'));
 assert.equal(gate.seen.filter(message=>message.type==='commit').length,3);
});
test('inflight_mutation_cannot_change_saved_image',{timeout:15000},async t=>{
 const f=fixture(t),gate=gateFactory(f),store=await open(f,{workerFactory:gate.factory}),submitted=image('captured'),before=structuredClone(submitted);
 const first=store.barrier(submitted,'dispatch');submitted.tasks[0].messages[0].text='changed after submission';await gate.committed;
 const waiting=image('waiting captured'),waitingBefore=structuredClone(waiting),second=store.barrier(waiting,'mission');waiting.tasks[0].messages[0].text='waiting mutation';
 gate.release();assert.equal((await first).stateSha256,digest(before));assert.equal((await second).stateSha256,digest(waitingBefore));await store.close();assert.deepEqual((await open(f)).load(),waitingBefore);
});
test('commit_without_receipt_is_uncertain',{timeout:15000},async t=>{
 const f=fixture(t),gate=gateFactory(f,{die:true}),store=await open(f,{workerFactory:gate.factory}),saved=image('committed before death');
 await assert.rejects(store.barrier(saved,'dispatch'),error=>error.code==='COMMIT_UNCERTAIN'&&error.sequence===1&&typeof error.epoch==='string');
 await assert.rejects(store.flush(),/uncertain/i);await assert.rejects(store.close(),/uncertain/i);assert.deepEqual((await open(f)).load(),saved);
});
test('forged_receipts_fail_closed',{timeout:15000},async t=>{
 for(const forge of [{epoch:'forged'},{sequence:0},{stateSha256:'0'.repeat(64)},{durableAt:NaN}]){
  const f=fixture(t),gate=gateFactory(f,{forge}),store=await open(f,{workerFactory:gate.factory});await assert.rejects(store.barrier(image(),'dispatch'),/receipt|protocol/i);await assert.rejects(store.close());
 }
});
test('worker_validates_authority_and_preserves_opaque_fields',{timeout:15000},async t=>{
 const f=fixture(t,'json'),store=await open(f),saved=image();await store.barrier(saved,'workspace');
 const next=image('next');delete next.opaque;await store.barrier(next,'mission');await store.close();assert.deepEqual((await open(f)).load(),{...next,opaque:saved.opaque});
 const invalid=image();invalid.missionBook.workspace.revision=-1;const reopened=f.stores.at(-1);await assert.rejects(reopened.barrier(invalid,'workspace'),/invalid|Unsupported/i);
});
test('large_images_preserve_complete_multibyte_transcripts',{timeout:60000},async t=>{
 for(const kind of ['sqlite','json'])for(const mib of [1,10,30]){
  const f=fixture(t,kind),store=await open(f),saved=image('航海🐳'.repeat(Math.ceil(mib*1024*1024/10)));const receipt=await store.barrier(saved,'shutdown');assert.equal(receipt.stateSha256,digest(saved));await store.close();assert.deepEqual((await open(f)).load(),saved);
 }
});
test('worker_start_failure_is_reported_without_unhandled_rejection',{timeout:15000},async t=>{
 const f=fixture(t);await assert.rejects(open(f,{workerFactory:()=>{throw Error('fixture worker unavailable');}}),/worker unavailable/);
});
test('invalid_checkpoint_image_cannot_save_an_unchanged_profile',{timeout:15000},async t=>{
 const f=fixture(t),store=await open(f);await store.barrier(image(),'workspace');await assert.rejects(store.checkpoint(null),/invalid|profile|image/i);
});
test('initialization_and_commit_timeouts_terminate_workers',{timeout:15000},async t=>{
 const f=fixture(t);let terminations=0;const silent=()=>{const bridge=new EventEmitter();bridge.postMessage=()=>{};bridge.terminate=async()=>{terminations++;};return bridge;};
 await assert.rejects(open(f,{workerFactory:silent,timeoutMs:50}),error=>error.code==='WORKER_TIMEOUT');assert.equal(terminations,1);
 const gate=gateFactory(f),store=await open(f,{workerFactory:gate.factory,timeoutMs:1000});const commit=store.barrier(image(),'mission');await gate.committed;
 await assert.rejects(commit,error=>error.code==='COMMIT_UNCERTAIN'&&/timed out/.test(error.message));await assert.rejects(store.close(),/timed out/);
});
test('commits_use_no_main_thread_writable_storage_apis',{timeout:15000},async t=>{
 const f=fixture(t,'json'),store=await open(f),core=require('../desktop/core.cjs');const originals=new Map();
 for(const [object,name] of [[fs,'writeFileSync'],[fs,'renameSync'],[fs,'fsyncSync'],[core,'StateStore'],[core,'SqliteStore']]){originals.set(name,{object,value:object[name]});object[name]=()=>{throw Error('Main-thread storage write: '+name);};}
 try{const saved=image('worker owned');assert.equal((await store.barrier(saved,'workspace')).stateSha256,digest(saved));}finally{for(const [name,{object,value}] of originals)object[name]=value;}
});
test('successful_v1_upgrade_retains_backup_and_reopens_exactly',{timeout:15000},async t=>{
 const f=fixture(t,'json'),saved=image();saved.missionBook={version:1,missions:[],future:'古い'};fs.writeFileSync(f.options.file,JSON.stringify(saved));
 const store=await open(f),upgraded=store.load();assert.equal((await store.barrier(upgraded,'workspace')).stateSha256,digest(upgraded));await store.close();assert.deepEqual((await open(f)).load(),upgraded);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.options.backupDir,fs.readdirSync(f.options.backupDir)[0]))),saved);
});
test('invalid_initial_profile_fails_without_overwrite',{timeout:15000},async t=>{
 const f=fixture(t,'json'),saved=image();saved.missionBook.version=99;const bytes=JSON.stringify(saved);fs.writeFileSync(f.options.file,bytes);
 await assert.rejects(open(f),/Unsupported|invalid/i);assert.equal(fs.readFileSync(f.options.file,'utf8'),bytes);
});
test('close_drains_accepted_barriers_and_rejects_new_images',{timeout:15000},async t=>{
 const f=fixture(t),gate=gateFactory(f),store=await open(f,{workerFactory:gate.factory}),saved=image('last barrier');
 const first=store.barrier(image('first'),'dispatch');await gate.committed;const second=store.barrier(saved,'cue'),closing=store.close();
 await assert.rejects(store.checkpoint(image('too late')),error=>error.code==='STORE_CLOSED');gate.release();await Promise.all([first,second,closing]);assert.deepEqual((await open(f)).load(),saved);
 const cached=f.stores.at(-1).load();cached.tasks[0].messages[0].text='mutated load';assert.deepEqual(f.stores.at(-1).load(),saved);
});
