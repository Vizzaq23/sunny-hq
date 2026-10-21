const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
test('private fixture markers permit only fixed bounded scalar stages',t=>{
 const api=require('../desktop/fixture-stages.cjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-stage-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const stage=api.createStages({outputDir:dir,phase:1});stage('app-ready');stage('load-enter');
 assert.throws(()=>stage('private prompt'),/stage/);assert.throws(()=>stage('load-exit',{nonce:'secret'}),/payload/);
 const records=fs.readFileSync(path.join(dir,'stages-1.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.equal(records.length,2);assert.deepEqual(Object.keys(records[0]).sort(),['elapsedMs','phase','stage','utc','version']);assert.ok(records[1].elapsedMs>=records[0].elapsedMs);
 for(let i=0;i<100;i++)stage('readiness-probe');assert.ok(fs.statSync(path.join(dir,'stages-1.jsonl')).size<16000);
});
test('never-resolving renderer readiness and cleanup reject within explicit fixture budgets',async()=>{
 const {bounded,waitUntilReady,withFailureStage}=require('../desktop/fixture-stages.cjs');
 await assert.rejects(waitUntilReady(()=>new Promise(()=>{}),{timeoutMs:20,probeMs:5,intervalMs:1}),/timed out/);
 const stages=[];await assert.rejects(withFailureStage(async()=>{throw Error('load rejected');},()=>new Promise(()=>{}),stage=>stages.push(stage),10),/load rejected/);assert.deepEqual(stages,['startup-failed','cleanup-enter','cleanup-unresolved']);
 await assert.rejects(bounded(new Promise(()=>{}),10),/timed out/);
});
