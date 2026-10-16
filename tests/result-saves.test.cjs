const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {receiptStore}=require('./helpers/receipt-store.cjs');
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
 let hub=new Hub({home:root,store:receiptStore(store),catalog});
 const input={taskId:source.id,messageId:'reply-1',title:'Reviewed report',text:'# Status\nReviewed by the captain.',reviewed:true};
 t.after(async()=>{await hub.close();fs.rmSync(root,{recursive:true,force:true});});
 return {root,vault,store,catalog,input,get hub(){return hub;},async restart(){if(!hub.closed)await hub.close();const next=new Store(store.file||path.join(root,'state.sqlite'));hub=new Hub({home:root,store:receiptStore(next),catalog});return hub;},notes(){const dir=path.join(vault,'00 Inbox');return fs.existsSync(dir)?fs.readdirSync(dir):[];}};
}

test('manual backup retains pending and saved results with exact receipt content',async t=>{
 const f=setup(t),saved=(await f.hub.resultSaves.save(f.input));
 const vault=f.hub.resultSaves.vault;f.hub.resultSaves.vault=()=>{throw Error('Unavailable fixture vault');};
 await assert.rejects(async()=>(await f.hub.resultSaves.save({...f.input,text:'Another reviewed revision'})),/Unavailable/);f.hub.resultSaves.vault=vault;
 const backup=JSON.parse(JSON.stringify(require('../desktop/backup.cjs').createBackup(f.hub)));
 assert.equal(backup.resultSaves.length,2);assert.equal(backup.resultSaves[0].status,'failed');
 assert.deepEqual(backup.resultSaves[1].receipt,saved.receipt);assert.equal(backup.resultSaves[1].text,f.input.text);
 assert.deepEqual(require('../desktop/result-saves.cjs').restoreResultSaves(backup.resultSaves),backup.resultSaves);
});

test('restore rejects corrupt or contradictory saved receipts and duplicate identities',async t=>{
 const f=setup(t),saved=(await f.hub.resultSaves.save(f.input)),{restoreResultSaves}=require('../desktop/result-saves.cjs');
 for(const change of [{receipt:undefined},{status:'made-up'},{sha256:'a'.repeat(64)},{text:'Unreviewed alteration'},{path:path.join(f.vault,'other.md')},{createdAt:NaN},{receipt:{...saved.receipt,path:'elsewhere'}},{receipt:{...saved.receipt,bytes:1}},{receipt:{...saved.receipt,id:'other'}}]){
  assert.throws(()=>restoreResultSaves([{...saved,...change}]),/invalid|corrupt|preserve/i);
 }
 assert.throws(()=>restoreResultSaves([saved,saved]),/invalid|duplicate|preserve/i);
 assert.throws(()=>restoreResultSaves([null]),/invalid|preserve/i);
 assert.deepEqual(restoreResultSaves(undefined),[]);
});

for(const Store of [StateStore,SqliteStore])test(`${Store.name}: reviewed result and exact receipt survive restart and repeated delivery`,async t=>{
 const f=setup(t,Store);const saved=(await f.hub.resultSaves.save(f.input));
 assert.equal(saved.status,'saved');assert.equal(saved.taskId,f.input.taskId);
 assert.equal(saved.receipt.path,saved.path);assert.equal(saved.receipt.sha256,hash(fs.readFileSync(saved.path)));
 assert.equal(saved.receipt.bytes,fs.statSync(saved.path).size);assert.equal(saved.messageId,'reply-1');
 await f.restart();assert.deepEqual(f.hub.state.resultSaves[0].receipt,saved.receipt);
 assert.equal((await f.hub.resultSaves.save(f.input)).id,saved.id);assert.equal(f.notes().length,1);
});

for(let trial=1;trial<=3;trial++)test(`recovery trial ${trial}: written note with lost receipt recovers one original note`,async t=>{
 const f=setup(t);const original=f.store.save.bind(f.store);let intent;
 f.store.save=value=>{const entry=value.resultSaves?.[0];if(entry?.status==='saved')throw Error('Fixture receipt disk failure');original(value);if(entry)intent=structuredClone(entry);};
 await assert.rejects(async()=>(await f.hub.resultSaves.save(f.input)),/receipt|disk|recovery/i);
 assert.equal(f.notes().length,1);assert.equal(f.hub.state.resultSaves[0].status,'needs-recovery');
 assert.equal(intent.taskId,f.input.taskId);f.store.save=original;
 await f.restart();const restored=f.hub.state.resultSaves[0];assert.equal(restored.status,'needs-recovery');
 const result=(await f.hub.resultSaves.recover({saveId:restored.id}));
 assert.equal(result.status,'saved');assert.equal(result.id,intent.id);assert.equal(result.path,intent.path);
 assert.equal(f.notes().length,1);assert.equal(f.hub.state.tasks[0].messages[0].text,'A project status report.');
 assert.equal(f.hub.state.approvals.length,0);
});

test('intent checkpoint failure creates no note or in-memory success',async t=>{
 const f=setup(t),original=f.store.save.bind(f.store);f.store.save=()=>{throw Error('Fixture checkpoint failed');};
 await assert.rejects(async()=>(await f.hub.resultSaves.save(f.input)),/checkpoint/);assert.equal(f.notes().length,0);assert.equal(f.hub.state.resultSaves.length,0);f.store.save=original;
});

test('missing vault preserves a failed intent and retries only at its reserved destination',async t=>{
 const f=setup(t);fs.rmdirSync(f.vault);
 await assert.rejects(async()=>(await f.hub.resultSaves.save(f.input)),/vault/i);
 const failed=f.hub.state.resultSaves[0];assert.equal(failed.status,'failed');assert.equal(failed.text,f.input.text);assert.equal(f.notes().length,0);
 await f.restart();fs.mkdirSync(f.vault);const result=(await f.hub.resultSaves.recover({saveId:failed.id}));assert.equal(result.status,'saved');assert.equal(result.path,failed.path);assert.equal(f.notes().length,1);
});

for(const Store of [StateStore,SqliteStore])for(const phase of ['before-write','after-note','after-receipt'])for(let trial=1;trial<=3;trial++)test(`${Store.name}: abrupt process exit ${phase}, trial ${trial}: restart recovers one exact note`,async t=>{
 const f=setup(t,Store);await f.hub.close();
 const child=spawnSync(process.execPath,[path.join(__dirname,'fixtures/result-save-crash.cjs'),f.root,phase,Store===SqliteStore?'sqlite':'json'],{encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(child.status,73,child.stderr||child.error?.message);
 const verificationStore=new Store(path.join(f.root,Store===SqliteStore?'state.sqlite':'state.json'));const disk=verificationStore.load().resultSaves[0];verificationStore.close();assert.equal(disk.taskId,f.input.taskId);assert.equal(disk.messageId,'reply-1');
 await f.restart();const result=(await f.hub.resultSaves.recover({saveId:disk.id}));
 assert.equal(result.status,'saved');assert.equal(result.path,disk.path);assert.equal(result.id,disk.id);assert.equal(f.notes().length,1);
 assert.equal(hash(fs.readFileSync(result.path)),result.receipt.sha256);
 assert.equal((await f.hub.resultSaves.save(f.input)).id,result.id);assert.equal(f.notes().length,1);
});

test('a junction replacing Inbox is refused, including links within the vault',async t=>{
 const f=setup(t);const alternate=path.join(f.vault,'alternate');fs.mkdirSync(alternate);fs.symlinkSync(alternate,path.join(f.vault,'00 Inbox'),process.platform==='win32'?'junction':'dir');
 await assert.rejects(async()=>(await f.hub.resultSaves.save(f.input)),/symbolic link/);assert.equal(fs.readdirSync(alternate).length,0);
 assert.equal(f.hub.state.resultSaves[0].status,'failed');
});

test('a definite directory failure persists failed status and retries the same operation',async t=>{
 const f=setup(t),inbox=path.join(f.vault,'00 Inbox');fs.writeFileSync(inbox,'directory conflict');
 await assert.rejects(async()=>(await f.hub.resultSaves.save(f.input)));const failed=f.hub.state.resultSaves[0];
 assert.equal(failed.status,'failed');assert.equal(f.store.load().resultSaves[0].status,'failed');
 fs.unlinkSync(inbox);await f.restart();const recovered=(await f.hub.resultSaves.recover({saveId:failed.id}));
 assert.equal(recovered.status,'saved');assert.equal(recovered.path,failed.path);assert.equal(f.notes().length,1);
});

test('conflicting or partial note is never overwritten or duplicated',async t=>{
 const f=setup(t);const saved=(await f.hub.resultSaves.save(f.input));fs.writeFileSync(saved.path,'Other edited content');
 await assert.rejects(async()=>(await f.hub.resultSaves.recover({saveId:saved.id})),/changed|conflict/i);
 assert.equal(f.hub.state.resultSaves[0].status,'needs-recovery');assert.equal(fs.readFileSync(saved.path,'utf8'),'Other edited content');
 await assert.rejects(async()=>(await f.hub.resultSaves.save(f.input)),/changed|conflict/i);assert.equal(f.notes().length,1);
});

test('checking a missing previously saved note does not recreate it',async t=>{
 const f=setup(t);const saved=(await f.hub.resultSaves.save(f.input));fs.unlinkSync(saved.path);
 await assert.rejects(async()=>(await f.hub.resultSaves.recover({saveId:saved.id})),/missing|removed/i);
 assert.equal(f.notes().length,0);assert.equal(f.hub.state.resultSaves[0].status,'needs-recovery');
});

test('changed vault cannot redirect recovery to another destination',async t=>{
 const f=setup(t);const saved=(await f.hub.resultSaves.save(f.input));const other=path.join(f.root,'other-vault');fs.mkdirSync(other);f.catalog.vaultPath=()=>other;
 await assert.rejects(async()=>(await f.hub.resultSaves.recover({saveId:saved.id})),/vault.*changed/i);assert.equal(fs.readdirSync(other).length,0);
});

test('saving another reviewed version keeps the previous receipt',async t=>{
 const f=setup(t);const first=(await f.hub.resultSaves.save(f.input));const second=(await f.hub.resultSaves.save({...f.input,text:'A revised report.'}));
 assert.notEqual(first.id,second.id);assert.equal(f.notes().length,2);assert.equal(f.hub.state.resultSaves.length,2);
});

test('reject stale, active, external, forged, unreviewed and oversized requests before writing',async t=>{
 const f=setup(t);
 for(const input of [{...f.input,messageId:'old'},{...f.input,reviewed:false},{...f.input,path:'elsewhere.md'},{...f.input,text:'💥'.repeat(60000)},{...f.input,title:'x'.repeat(121)}])await assert.rejects(async()=>(await f.hub.resultSaves.save(input)));
 const task=f.hub.state.tasks[0];task.status='working';await assert.rejects(async()=>(await f.hub.resultSaves.save(f.input)),/finished/i);task.status='finished';task.external=true;await assert.rejects(async()=>(await f.hub.resultSaves.save(f.input)),/local/i);
 assert.equal(f.notes().length,0);assert.equal(f.hub.state.resultSaves.length,0);
});
test('an accepted earlier reply saves only with the current exact acceptance binding',async t=>{
 const f=setup(t),task=f.hub.task(f.input.taskId),first=task.messages.find(m=>m.id===f.input.messageId);
 task.messages.push({id:'later',role:'assistant',text:'Later commentary',time:Date.now()});
 const mission=f.hub.missionBook.create({projectId:task.projectId,title:'Accepted report',objective:'Review the report',acceptanceCriteria:['Exact facts']});
 const attempt=f.hub.missionBook.begin(mission.id,mission.revision);attempt.taskId=task.id;attempt.taskIds=[task.id];mission.taskIds=[task.id];f.hub.missionBook.sync([task],[]);mission.selectedResult={id:'selection',attemptId:attempt.id,producerTaskId:task.id,ref:{kind:'reply',taskId:task.id,messageId:first.id,sha256:hash(first.text)}};mission.selectedResult.selectedAt=Date.now();f.hub.missionBook.accept(mission.id,mission.revision,[true],{resultId:'selection',attemptId:attempt.id,producerTaskId:task.id,ref:mission.selectedResult.ref});
 f.hub.state.missions=f.hub.missionBook.data.missions;
 const input={...f.input,text:first.text};assert.equal((await f.hub.resultSaves.save(input)).messageId,first.id);
 mission.acceptance.resultSha256='a'.repeat(64);
 await assert.rejects(f.hub.resultSaves.save(input),/changed/);mission.acceptance.resultSha256=hash(first.text);
});
