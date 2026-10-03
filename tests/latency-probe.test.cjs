const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {AuthorityCommitQueue}=require('../desktop/persistence-barriers.cjs');
const {openOrderedStore}=require('../desktop/ordered-store.cjs');
const {emptyWorkspace}=require('../desktop/mission-profile.cjs');
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
  if(enabled){assert.ok(Object.values(records[0]).every(Number.isFinite));assert.equal(records[0].sequence,receipt.sequence);assert.equal(records[0].failed,0);assert.ok(records[0].total>=records[0].adapterSave);}
  await store.close();
 }
});
