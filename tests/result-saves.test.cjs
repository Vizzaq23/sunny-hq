const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Hub}=require('../desktop/hub.cjs');
const {StateStore,SqliteStore,hash}=require('../desktop/core.cjs');
const {spawnSync}=require('node:child_process');

function setup(t,Store=StateStore){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-result-save-'));
 const vault=path.join(root,'vault');fs.mkdirSync(vault);
 const store=new Store(path.join(root,Store===StateStore?'state.json':'state.sqlite'));
 const source={id:'task-result',projectId:'p',crewId:'morgans',status:'finished',executionId:'execution-1',messages:[{id:'reply-1',role:'assistant',text:'A project status report.',time:1}],createdAt:1,updatedAt:2};
 store.save({projects:[{id:'p',name:'Fixture',path:root}],tasks:[source]});
 const catalog={discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[],vaultPath:()=>vault};
 let hub=new Hub({home:root,store,catalog});
 const input={taskId:source.id,messageId:'reply-1',title:'Reviewed report',text:'# Status\nReviewed by the captain.',reviewed:true};
 t.after(()=>{hub.close();fs.rmSync(root,{recursive:true,force:true});});
 return {root,vault,store,catalog,input,get hub(){return hub;},restart(){if(!hub.closed)hub.close();const next=new Store(store.file||path.join(root,'state.sqlite'));hub=new Hub({home:root,store:next,catalog});return hub;},notes(){const dir=path.join(vault,'00 Inbox');return fs.existsSync(dir)?fs.readdirSync(dir):[];}};
}

test('manual backup retains pending and saved results with exact receipt content',t=>{
 const f=setup(t),saved=f.hub.resultSaves.save(f.input);
 const vault=f.hub.resultSaves.vault;f.hub.resultSaves.vault=()=>{throw Error('Unavailable fixture vault');};
 assert.throws(()=>f.hub.resultSaves.save({...f.input,text:'Another reviewed revision'}),/Unavailable/);f.hub.resultSaves.vault=vault;
 const backup=JSON.parse(JSON.stringify(require('../desktop/backup.cjs').createBackup(f.hub)));
 assert.equal(backup.resultSaves.length,2);assert.equal(backup.resultSaves[0].status,'failed');
 assert.deepEqual(backup.resultSaves[1].receipt,saved.receipt);assert.equal(backup.resultSaves[1].text,f.input.text);
 assert.deepEqual(require('../desktop/result-saves.cjs').restoreResultSaves(backup.resultSaves),backup.resultSaves);
});

test('restore rejects corrupt or contradictory saved receipts and duplicate identities',t=>{
 const f=setup(t),saved=f.hub.resultSaves.save(f.input),{restoreResultSaves}=require('../desktop/result-saves.cjs');
 for(const change of [{receipt:undefined},{status:'made-up'},{sha256:'a'.repeat(64)},{text:'Unreviewed alteration'},{path:path.join(f.vault,'other.md')},{createdAt:NaN},{receipt:{...saved.receipt,path:'elsewhere'}},{receipt:{...saved.receipt,bytes:1}},{receipt:{...saved.receipt,id:'other'}}]){
  assert.throws(()=>restoreResultSaves([{...saved,...change}]),/invalid|corrupt|preserve/i);
 }
 assert.throws(()=>restoreResultSaves([saved,saved]),/invalid|duplicate|preserve/i);
 assert.throws(()=>restoreResultSaves([null]),/invalid|preserve/i);
 assert.deepEqual(restoreResultSaves(undefined),[]);
});

for(const Store of [StateStore,SqliteStore])test(`${Store.name}: reviewed result and exact receipt survive restart and repeated delivery`,t=>{
 const f=setup(t,Store);const saved=f.hub.resultSaves.save(f.input);
 assert.equal(saved.status,'saved');assert.equal(saved.taskId,f.input.taskId);
 assert.equal(saved.receipt.path,saved.path);assert.equal(saved.receipt.sha256,hash(fs.readFileSync(saved.path)));
 assert.equal(saved.receipt.bytes,fs.statSync(saved.path).size);assert.equal(saved.messageId,'reply-1');
 f.restart();assert.deepEqual(f.hub.state.resultSaves[0].receipt,saved.receipt);
 assert.equal(f.hub.resultSaves.save(f.input).id,saved.id);assert.equal(f.notes().length,1);
});

for(let trial=1;trial<=3;trial++)test(`recovery trial ${trial}: written note with lost receipt recovers one original note`,t=>{
 const f=setup(t);const original=f.store.save.bind(f.store);let intent;
 f.store.save=value=>{const entry=value.resultSaves?.[0];if(entry?.status==='saved')throw Error('Fixture receipt disk failure');original(value);if(entry)intent=structuredClone(entry);};
 assert.throws(()=>f.hub.resultSaves.save(f.input),/receipt|disk|recovery/i);
 assert.equal(f.notes().length,1);assert.equal(f.hub.state.resultSaves[0].status,'needs-recovery');
 assert.equal(intent.taskId,f.input.taskId);f.store.save=original;
 f.restart();const restored=f.hub.state.resultSaves[0];assert.equal(restored.status,'needs-recovery');
 const result=f.hub.resultSaves.recover({saveId:restored.id});
 assert.equal(result.status,'saved');assert.equal(result.id,intent.id);assert.equal(result.path,intent.path);
 assert.equal(f.notes().length,1);assert.equal(f.hub.state.tasks[0].messages[0].text,'A project status report.');
 assert.equal(f.hub.state.approvals.length,0);
});

test('intent checkpoint failure creates no note or in-memory success',t=>{
 const f=setup(t),original=f.store.save.bind(f.store);f.store.save=()=>{throw Error('Fixture checkpoint failed');};
 assert.throws(()=>f.hub.resultSaves.save(f.input),/checkpoint/);assert.equal(f.notes().length,0);assert.equal(f.hub.state.resultSaves.length,0);f.store.save=original;
});

test('missing vault preserves a failed intent and retries only at its reserved destination',t=>{
 const f=setup(t);fs.rmdirSync(f.vault);
 assert.throws(()=>f.hub.resultSaves.save(f.input),/vault/i);
 const failed=f.hub.state.resultSaves[0];assert.equal(failed.status,'failed');assert.equal(failed.text,f.input.text);assert.equal(f.notes().length,0);
 f.restart();fs.mkdirSync(f.vault);const result=f.hub.resultSaves.recover({saveId:failed.id});assert.equal(result.status,'saved');assert.equal(result.path,failed.path);assert.equal(f.notes().length,1);
});

for(const Store of [StateStore,SqliteStore])for(const phase of ['before-write','after-note','after-receipt'])for(let trial=1;trial<=3;trial++)test(`${Store.name}: abrupt process exit ${phase}, trial ${trial}: restart recovers one exact note`,t=>{
 const f=setup(t,Store);f.hub.close();
 const child=spawnSync(process.execPath,[path.join(__dirname,'fixtures/result-save-crash.cjs'),f.root,phase,Store===SqliteStore?'sqlite':'json'],{encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(child.status,73,child.stderr||child.error?.message);
 const verificationStore=new Store(path.join(f.root,Store===SqliteStore?'state.sqlite':'state.json'));const disk=verificationStore.load().resultSaves[0];verificationStore.close();assert.equal(disk.taskId,f.input.taskId);assert.equal(disk.messageId,'reply-1');
 f.restart();const result=f.hub.resultSaves.recover({saveId:disk.id});
 assert.equal(result.status,'saved');assert.equal(result.path,disk.path);assert.equal(result.id,disk.id);assert.equal(f.notes().length,1);
 assert.equal(hash(fs.readFileSync(result.path)),result.receipt.sha256);
 assert.equal(f.hub.resultSaves.save(f.input).id,result.id);assert.equal(f.notes().length,1);
});

test('a junction replacing Inbox is refused, including links within the vault',t=>{
 const f=setup(t);const alternate=path.join(f.vault,'alternate');fs.mkdirSync(alternate);fs.symlinkSync(alternate,path.join(f.vault,'00 Inbox'),process.platform==='win32'?'junction':'dir');
 assert.throws(()=>f.hub.resultSaves.save(f.input),/symbolic link/);assert.equal(fs.readdirSync(alternate).length,0);
 assert.equal(f.hub.state.resultSaves[0].status,'failed');
});

test('a definite directory failure persists failed status and retries the same operation',t=>{
 const f=setup(t),inbox=path.join(f.vault,'00 Inbox');fs.writeFileSync(inbox,'directory conflict');
 assert.throws(()=>f.hub.resultSaves.save(f.input));const failed=f.hub.state.resultSaves[0];
 assert.equal(failed.status,'failed');assert.equal(f.store.load().resultSaves[0].status,'failed');
 fs.unlinkSync(inbox);f.restart();const recovered=f.hub.resultSaves.recover({saveId:failed.id});
 assert.equal(recovered.status,'saved');assert.equal(recovered.path,failed.path);assert.equal(f.notes().length,1);
});

test('conflicting or partial note is never overwritten or duplicated',t=>{
 const f=setup(t);const saved=f.hub.resultSaves.save(f.input);fs.writeFileSync(saved.path,'Other edited content');
 assert.throws(()=>f.hub.resultSaves.recover({saveId:saved.id}),/changed|conflict/i);
 assert.equal(f.hub.state.resultSaves[0].status,'needs-recovery');assert.equal(fs.readFileSync(saved.path,'utf8'),'Other edited content');
 assert.throws(()=>f.hub.resultSaves.save(f.input),/changed|conflict/i);assert.equal(f.notes().length,1);
});

test('checking a missing previously saved note does not recreate it',t=>{
 const f=setup(t);const saved=f.hub.resultSaves.save(f.input);fs.unlinkSync(saved.path);
 assert.throws(()=>f.hub.resultSaves.recover({saveId:saved.id}),/missing|removed/i);
 assert.equal(f.notes().length,0);assert.equal(f.hub.state.resultSaves[0].status,'needs-recovery');
});

test('changed vault cannot redirect recovery to another destination',t=>{
 const f=setup(t);const saved=f.hub.resultSaves.save(f.input);const other=path.join(f.root,'other-vault');fs.mkdirSync(other);f.catalog.vaultPath=()=>other;
 assert.throws(()=>f.hub.resultSaves.recover({saveId:saved.id}),/vault.*changed/i);assert.equal(fs.readdirSync(other).length,0);
});

test('saving another reviewed version keeps the previous receipt',t=>{
 const f=setup(t);const first=f.hub.resultSaves.save(f.input);const second=f.hub.resultSaves.save({...f.input,text:'A revised report.'});
 assert.notEqual(first.id,second.id);assert.equal(f.notes().length,2);assert.equal(f.hub.state.resultSaves.length,2);
});

test('reject stale, active, external, forged, unreviewed and oversized requests before writing',t=>{
 const f=setup(t);
 for(const input of [{...f.input,messageId:'old'},{...f.input,reviewed:false},{...f.input,path:'elsewhere.md'},{...f.input,text:'💥'.repeat(60000)},{...f.input,title:'x'.repeat(121)}])assert.throws(()=>f.hub.resultSaves.save(input));
 const task=f.hub.state.tasks[0];task.status='working';assert.throws(()=>f.hub.resultSaves.save(f.input),/finished/i);task.status='finished';task.external=true;assert.throws(()=>f.hub.resultSaves.save(f.input),/local/i);
 assert.equal(f.notes().length,0);assert.equal(f.hub.state.resultSaves.length,0);
});
