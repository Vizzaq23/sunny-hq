const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
test('persistence profiling uses a bounded synthetic task state at the requested byte scale',()=>{
 const script=path.join(__dirname,'../scripts/persistence-profile.cjs');assert.ok(fs.existsSync(script),'profiling script exists');const {buildSyntheticState}=require(script);const state=buildSyntheticState(1);const bytes=Buffer.byteLength(JSON.stringify(state));assert.ok(bytes>=1024*1024&&bytes<1024*1024+50000);assert.ok(state.tasks.length>10);assert.equal(state.tasks[0].messages.length,40);assert.ok(state.tasks.every(task=>task.messages.every(message=>message.text.startsWith('SYNTHETIC fixture'))));assert.throws(()=>buildSyntheticState(300),/1-30/);
});
test('profile summaries use observed samples and nearest-rank latency percentiles',()=>{
 const script=path.join(__dirname,'../scripts/persistence-profile.cjs');assert.ok(fs.existsSync(script),'profiling script exists');const {summarize}=require(script);assert.deepEqual(summarize([1,2,3,4,5,6,7,8,9,10]),{count:10,min:1,p50:5,p95:10,max:10,mean:5.5,over100ms:0});
});

test('v2 worker upgrade retains exact backup and full profile on reopen',async t=>{
 const {openOrderedStore}=require('../desktop/ordered-store.cjs');
 for(const kind of ['json','sqlite']){
  const directory=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'sunny-v2-worker-')),file=path.join(directory,kind==='json'?'state.json':'sunny.sqlite'),backupDir=path.join(directory,'backups'),stores=[];
  t.after(async()=>{await Promise.allSettled(stores.map(store=>store.close()));fs.rmSync(directory,{recursive:true,force:true});});
  const {MissionBook}=require('../desktop/missions.cjs'),book=new MissionBook();book.data.version=2;delete book.data.runs;book.data.opaqueBook={retain:true};const original={opaque:{retain:'☀'},tasks:[{id:'legacy',messages:[{text:'full transcript\n'}]}],settings:{draft:'retain exact draft'},missionBook:book.data};
  if(kind==='json')fs.writeFileSync(file,JSON.stringify(original));else{const raw=new(require('../desktop/core.cjs').SqliteStore)(file);raw.save(original);raw.close();}
  const store=await openOrderedStore({kind,file,backupDir});stores.push(store);const loaded=store.load();assert.deepEqual(loaded,{...original,missionBook:{...original.missionBook,version:3,runs:[]}});assert.equal(fs.readFileSync(path.join(backupDir,fs.readdirSync(backupDir)[0]),'utf8'),JSON.stringify(original,null,2));
  await store.barrier(loaded,'mission');await store.close();const reopened=await openOrderedStore({kind,file,backupDir});stores.push(reopened);assert.deepEqual(reopened.load(),loaded);assert.equal(fs.readdirSync(backupDir).filter(name=>name!=='storage-format').length,1);if(kind==='sqlite')assert.ok(fs.readdirSync(path.join(backupDir,'storage-format')).some(name=>name.endsWith('.receipt.json')));
 }
});
