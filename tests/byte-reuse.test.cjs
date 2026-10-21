const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {MissionBook}=require('../desktop/missions.cjs');
test('actual worker binds the exact prepared fragments and their receipt digest',async()=>{
 let listener,bound,preparations=0;const messages=[],image={missionBook:new MissionBook().data,opaqueBoundaryMarker:'☀',tasks:[]};
 const backend={durability:{journalMode:'wal',synchronous:2},load:()=>({}),close(){},prepare(candidate){preparations++;const encoded=require('../desktop/profile-json.cjs').encodeProfile(candidate),map=new Map(encoded.fragments.map(f=>[f.id,f.bytes]));return {stateSha256:encoded.stateSha256,commit(){bound=Buffer.concat(encoded.layout.map(id=>map.get(id))).toString('utf8');}};}};
 const port={postMessage:message=>messages.push(message),close(){},on:(type,fn)=>{listener=fn;}};
 const filename=path.join(__dirname,'../desktop/persistence-worker.cjs');
 const req=name=>name==='node:worker_threads'?{isMainThread:false,parentPort:port,workerData:{kind:'sqlite',file:path.join(__dirname,'nonexistent-boundary.sqlite'),epoch:'test',backupDir:__dirname}}:name==='./fragment-store.cjs'?{openFragmentStore:async()=>backend}:name.startsWith('./')?require('../desktop/'+name.slice(2)):require(name);
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:req,JSON,structuredClone,Date,Buffer,process,__filename:filename},{filename});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(messages.at(-1).type,'ready');
 listener({type:'commit',epoch:'test',sequence:1,update:{kind:'full',baseGeneration:0,image:structuredClone(image)}});
 assert.equal(messages.at(-1).type,'committed',JSON.stringify(messages));assert.equal(bound,JSON.stringify(image));assert.equal(messages.at(-1).receipt.stateSha256,require('node:crypto').createHash('sha256').update(bound).digest('hex'));assert.equal(preparations,1);
});

const {prepareWorkerMissionProfileStore}=require('../desktop/mission-profile.cjs');
function privateFixture(saved={missionBook:new MissionBook().data,opaque:{old:true}}){let disk=saved,fail=false;const store=prepareWorkerMissionProfileStore({load:()=>saved,close(){}},__dirname,text=>{if(fail)throw Error('raw failure');disk=JSON.parse(text);});return {store,get disk(){return disk;},fail(){fail=true;}};}
test('private lifecycle preserves undefined cache, shallow opaque merge and defensive loads',()=>{
 const fixture=privateFixture(),store=fixture.store;
 const prepared=store.prepareOwned({opaque:undefined,future:{unicode:'☀'}});assert.ok(Object.isFrozen(prepared));assert.throws(()=>store.prepareOwned({}),/pending/);
 const loaded=store.load();loaded.opaque.old=false;prepared.commit();assert.throws(()=>prepared.commit(),/consumed/);
 assert.ok(Object.hasOwn(store.load(),'opaque'));assert.equal(store.load().opaque,undefined);store.prepareOwned({settings:{nested:true}}).commit();assert.equal(fixture.disk.opaque,undefined);assert.deepEqual(fixture.disk.future,{unicode:'☀'});
 const pending=store.prepareOwned({});store.close();assert.throws(()=>pending.commit(),/consumed/);
});
test('failed validation and raw write preserve cache and consume preparation',()=>{
 const fixture=privateFixture(),before=fixture.store.load();const bad=structuredClone(before);bad.missionBook.missions=[,];assert.throws(()=>fixture.store.prepareOwned(bad),/Unsupported/);assert.deepEqual(fixture.store.load(),before);
 fixture.fail();const prepared=fixture.store.prepareOwned({opaque:{new:true}});assert.throws(()=>prepared.commit(),/raw failure/);assert.deepEqual(fixture.store.load(),before);assert.throws(()=>prepared.commit(),/consumed/);
});
test('native workers persist exact compact UTF-8 and digest for partial opaque and undefined commits',async t=>{
 const {openOrderedStore}=require('../desktop/ordered-store.cjs');const os=require('node:os');
 for(const kind of ['json','sqlite']){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'byte-reuse-')),file=path.join(directory,kind==='json'?'state.json':'state.sqlite'),backupDir=path.join(directory,'backups');let store;
  t.after(async()=>{await store?.close().catch(()=>{});fs.rmSync(directory,{recursive:true,force:true});});
  store=await openOrderedStore({kind,file,backupDir});const image={missionBook:new MissionBook().data,tasks:[],opaque:{text:'☀\\\"\n',date:new Date(0),typed:new Uint8Array([1,2])},deleted:'old'};
  await store.barrier(image,'mission');await store.barrier({deleted:undefined},'mission');const receipt=await store.barrier({future:{retained:true}},'mission');await store.close();
  let compact;if(kind==='json')compact=fs.readFileSync(file,'utf8');else{const db=new(require('node:sqlite').DatabaseSync)(file);compact=db.prepare('SELECT value FROM state WHERE id=1').get().value;db.close();}
  const expected=JSON.stringify({...image,deleted:undefined,future:{retained:true}});assert.equal(compact,expected);assert.equal(receipt.stateSha256,require('node:crypto').createHash('sha256').update(compact).digest('hex'));
  store=await openOrderedStore({kind,file,backupDir});assert.deepEqual(store.load(),JSON.parse(expected));
 }
});
test('private first commit rechecks exact v1/v2 backup after preparation',t=>{
 const os=require('node:os');for(const version of [1,2])for(const change of ['delete','tamper']){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'byte-backup-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const saved={missionBook:new MissionBook().data,opaque:{all:'retain'}};saved.missionBook.version=version;delete saved.missionBook.runs;if(version===1)delete saved.missionBook.workspace;
  let writes=0;const store=prepareWorkerMissionProfileStore({load:()=>saved,close(){}},directory,()=>writes++),before=store.load(),prepared=store.prepareOwned({});const backup=path.join(directory,fs.readdirSync(directory)[0]);assert.equal(fs.readFileSync(backup,'utf8'),JSON.stringify(saved,null,2));if(change==='delete')fs.unlinkSync(backup);else fs.appendFileSync(backup,'tamper');assert.throws(()=>prepared.commit());assert.equal(writes,0);assert.deepEqual(store.load(),before);assert.throws(()=>prepared.commit(),/consumed/);store.close();
 }
});
test('private invalid authority and cyclic encoding failures preserve cache',()=>{
 const fixture=privateFixture(),before=fixture.store.load(),image=structuredClone(before);image.missionBook.workspace.revision=NaN;assert.throws(()=>fixture.store.prepareOwned(image));assert.deepEqual(fixture.store.load(),before);
 const cycle={};cycle.self=cycle;assert.throws(()=>fixture.store.prepareOwned({opaque:cycle}),/circular/i);assert.deepEqual(fixture.store.load(),before);
});

