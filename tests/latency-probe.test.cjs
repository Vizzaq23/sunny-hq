const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {AuthorityCommitQueue}=require('../desktop/persistence-barriers.cjs');
const {openOrderedStore}=require('../desktop/ordered-store.cjs');
const {emptyWorkspace,prepareMissionProfileStore}=require('../desktop/mission-profile.cjs');
const {SqliteStore}=require('../desktop/core.cjs');
const image=()=>({tasks:[],projects:[],opaque:{preserved:'value'},missionBook:{version:3,runs:[],missions:[],workspace:emptyWorkspace()}});
const split=()=>Object.fromEntries(['adapterCloneMerge','adapterValidation','adapterRawSave','adapterBookkeeping','adapterTotal','adapterStage','adapterFailed','sqlPrepare','sqlStringify','sqlRun','sqlTotal','sqlStage','sqlFailed'].map(key=>[key,0]));
test('raw split preserves prepare, run lookup, stringify, receiver and original thrown failures',()=>{
 for(const enabled of [false,true])for(const failure of [null,'prepare','lookup','stringify','run']){
  const order=[],error=Error(failure),probe=enabled?split():undefined;
  const statement={get run(){order.push('lookup');if(failure==='lookup')throw error;return function(bytes){order.push('run');assert.equal(this,statement);assert.equal(bytes,'{"value":1}');if(failure==='run')throw error;};}};
  const store=Object.create(SqliteStore.prototype);store.db={prepare(){order.push('prepare');if(failure==='prepare')throw error;return statement;}};
  const value={toJSON(){order.push('stringify');if(failure==='stringify')throw error;return {value:1};}};
  if(failure)assert.throws(()=>store.save(value,probe),actual=>actual===error);else store.save(value,probe);
  assert.deepEqual(order,['prepare','lookup','stringify','run'].slice(0,failure==='prepare'?1:failure==='lookup'?2:failure==='stringify'?3:4));
  if(enabled){assert.equal(probe.sqlFailed,failure?1:0);assert.equal(probe.sqlStage,failure==='prepare'||failure==='lookup'?0:failure==='stringify'?1:failure==='run'?2:3);assert.ok(Object.values(probe).every(Number.isFinite));assert.ok(probe.sqlTotal>=probe.sqlPrepare+probe.sqlStringify+probe.sqlRun);}
 }
});
test('adapter split retains opaque/undefined semantics and publishes current only after raw success',()=>{
 for(const enabled of [false,true]){
  let persisted=image(),failure=false,calls=0;const error=Error('raw failed');
  const store=prepareMissionProfileStore({load:()=>persisted,save(value){calls++;if(failure)throw error;persisted=structuredClone(value);},close(){}},'unused');
  store.save({projects:[]},enabled?split():undefined);assert.deepEqual(store.load().opaque,{preserved:'value'});
  const probe=enabled?split():undefined;store.save({...image(),opaque:undefined},probe);assert.equal(store.load().opaque,undefined);
  if(enabled){assert.equal(probe.adapterStage,4);assert.equal(probe.adapterFailed,0);assert.ok(probe.adapterTotal>=probe.adapterCloneMerge+probe.adapterValidation+probe.adapterRawSave+probe.adapterBookkeeping);}
  const previous=store.load();failure=true;const failedProbe=enabled?split():undefined;
  assert.throws(()=>store.save({...image(),opaque:{new:'unpublished'}},failedProbe),actual=>actual===error);assert.deepEqual(store.load(),previous);
  if(enabled){assert.equal(failedProbe.adapterStage,2);assert.equal(failedProbe.adapterFailed,1);}
  const validationProbe=enabled?split():undefined;assert.throws(()=>store.save({missionBook:null},validationProbe),/Unsupported or invalid/);assert.deepEqual(store.load(),previous);assert.equal(calls,3);
  if(enabled){assert.equal(validationProbe.adapterStage,1);assert.equal(validationProbe.adapterFailed,1);}
 }
});
test('queue probe records skipped and failed stages and cannot alter outcomes',async()=>{
 const records=[];const queue=new AuthorityCommitQueue({store:{barrier:async()=>({epoch:'test',sequence:1,durableAt:1,stateSha256:'a'.repeat(64)})},observeCommit:r=>{records.push(r);throw Error('observer');}});
 assert.equal(await queue.run('mission',async()=>({skip:true,publish:()=>42})),42);
 await assert.rejects(queue.run('mission',async()=>{throw Error('prepare failed');}),/prepare failed/);
 assert.equal(records[0].skipped,1);assert.equal(records[1].failed,1);assert.equal(records[1].stage,1);
 assert.ok(records.every(r=>Object.values(r).every(Number.isFinite)));
 const receipt=await queue.run('mission',async()=>({image:{}}));assert.equal(receipt.sequence,1);assert.equal(records[2].sequence,1);assert.ok(records[2].submission>=records[2].validation);
});
test('worker numeric summary is optional and observer failure preserves exact receipt',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-probe-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const image={tasks:[],projects:[],missionBook:{version:3,runs:[],missions:[],workspace:emptyWorkspace()}};
 for(const enabled of [false,true]){
  const records=[];const store=await openOrderedStore({kind:'sqlite',file:path.join(directory,enabled+'.sqlite'),backupDir:path.join(directory,'backups'),latencyProbe:enabled,observeCommit:r=>{records.push(r);throw Error('observer');}});
  const receipt=await store.barrier(image,'mission');assert.deepEqual(Object.keys(receipt).sort(),['durableAt','epoch','sequence','stateSha256']);assert.equal(records.length,enabled?1:0);
  if(enabled){assert.ok(Object.values(records[0]).every(Number.isFinite));assert.equal(records[0].sequence,receipt.sequence);assert.equal(records[0].failed,0);assert.ok(records[0].total>=records[0].adapterSave);assert.equal(records[0].adapterStage,4);assert.equal(records[0].sqlStage,3);assert.ok(records[0].adapterSave>=records[0].adapterTotal);assert.ok(records[0].adapterRawSave>=records[0].sqlTotal);assert.ok(records[0].sqlTotal>=records[0].sqlPrepare+records[0].sqlStringify+records[0].sqlRun);}
  await store.close();
  const raw=new SqliteStore(path.join(directory,enabled+'.sqlite'));assert.deepEqual(raw.load(),image);raw.close();
 }
});
test('worker failed observations and throwing observer preserve validation failure',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-probe-failed-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 for(const enabled of [false,true]){
  const records=[];const store=await openOrderedStore({kind:'sqlite',file:path.join(directory,enabled+'.sqlite'),backupDir:path.join(directory,'backups'),latencyProbe:enabled,observeCommit:r=>{records.push(r);throw Error('observer replacement');}});
  await assert.rejects(store.barrier({missionBook:null},'mission'),error=>error.code==='STORE_FAILED'&&/Unsupported or invalid/.test(error.message));
  assert.equal(records.length,enabled?1:0);if(enabled){assert.equal(records[0].failed,1);assert.equal(records[0].stage,1);assert.equal(records[0].adapterStage,0);assert.ok(Object.values(records[0]).every(Number.isFinite));}
  await assert.rejects(store.close(),/Unsupported or invalid/);
 }
});
