const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
test('persistence profiling uses a bounded synthetic task state at the requested byte scale',()=>{
 const script=path.join(__dirname,'../scripts/persistence-profile.cjs');assert.ok(fs.existsSync(script),'profiling script exists');const {buildSyntheticState}=require(script);const state=buildSyntheticState(1);const bytes=Buffer.byteLength(JSON.stringify(state));assert.ok(bytes>=1024*1024&&bytes<1024*1024+50000);assert.ok(state.tasks.length>10);assert.equal(state.tasks[0].messages.length,40);assert.ok(state.tasks.every(task=>task.messages.every(message=>message.text.startsWith('SYNTHETIC fixture'))));assert.throws(()=>buildSyntheticState(300),/1-30/);
});
test('profile summaries use observed samples and nearest-rank latency percentiles',()=>{
 const script=path.join(__dirname,'../scripts/persistence-profile.cjs');assert.ok(fs.existsSync(script),'profiling script exists');const {summarize}=require(script);assert.deepEqual(summarize([1,2,3,4,5,6,7,8,9,10]),{count:10,min:1,p50:5,p95:10,max:10,mean:5.5,over100ms:0});
});
