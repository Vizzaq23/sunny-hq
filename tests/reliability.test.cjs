const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {PassThrough}=require('node:stream');const {EventEmitter}=require('node:events');
const diagnostics=require('../desktop/diagnostics.cjs');const {Hub}=require('../desktop/hub.cjs');const {CodexClient}=require('../desktop/codex.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-reliability-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function hubFixture(t,store){const hub=new Hub({home:process.cwd(),store,catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});t.after(()=>hub.close());return hub;}
function peer(){const p=new EventEmitter();p.stdin=new PassThrough();p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=()=>{};return p;}
test('renderer diagnostics retain build and surface evidence while excluding private fields',t=>{
 const dir=fixture(t);diagnostics.record(dir,'renderer-gone',{surface:'companion',appVersion:'0.11.0',electronVersion:'44.4.3',buildId:'a'.repeat(64),sourceCommit:'b'.repeat(40),sourceDirty:true,reason:'crashed',exitCode:-1073741819,url:'https://private.test',description:'SECRET',prompt:'SECRET'});
 const line=fs.readFileSync(path.join(dir,'startup.log'),'utf8');assert.match(line,/"surface":"companion"/);assert.match(line,/"reason":"crashed"/);assert.match(line,/"exitCode":-1073741819/);assert.match(line,/"buildId":"a{64}"/);assert.doesNotMatch(line,/SECRET|private.test|url|description|prompt/);
 diagnostics.record(dir,'renderer-gone',{surface:'hub\nSECRET',reason:'secret\ntext',exitCode:NaN,buildId:'SECRET',sourceCommit:'SECRET',appVersion:'0.11.0\nSECRET'});
 const last=fs.readFileSync(path.join(dir,'startup.log'),'utf8').trim().split('\n').at(-1);assert.match(last,/"reason":"unknown"/);assert.doesNotMatch(last,/SECRET|NaN/);
});
test('renderer lifecycle diagnostics cover both surfaces and ignore aborted/subframe loads',async()=>{
 assert.equal(typeof diagnostics.watchRenderer,'function');
 for(const surface of ['hub','companion']){const contents=new EventEmitter();const records=[],gone=[];diagnostics.watchRenderer(contents,{surface,record:(event,details)=>records.push({event,details}),onGone:details=>gone.push(details)});
  contents.emit('did-fail-load',{},-3,'private','https://private',true);contents.emit('did-fail-load',{},-2,'private','https://private',false);contents.emit('did-fail-load',{},-2,'private','https://private',true);contents.emit('did-finish-load');contents.emit('render-process-gone',{}, {reason:'crashed',exitCode:7,url:'SECRET'});await Promise.resolve();
  assert.deepEqual(records,[{event:'load-failed',details:{surface,code:-2}},{event:'window-loaded',details:{surface}},{event:'renderer-gone',details:{surface,reason:'crashed',exitCode:7}}]);assert.deepEqual(gone,[{surface,reason:'crashed',exitCode:7}]);
 }
});
test('renderer recovery reload requires an explicit choice and a live non-quitting surface',async()=>{
 assert.equal(typeof diagnostics.offerReload,'function');let reloads=0;let quitting=false,destroyed=false;const win={isDestroyed:()=>destroyed,reload:()=>reloads++};let options;
 await diagnostics.offerReload(win,{surface:'companion',reason:'crashed',exitCode:7,isQuitting:()=>quitting,showMessageBox:async(_win,next)=>{options=next;return {response:1};}});assert.equal(reloads,0);assert.equal(options.cancelId,1);assert.match(options.detail,/crashed.*7/);
 await diagnostics.offerReload(win,{surface:'hub',isQuitting:()=>quitting,showMessageBox:async()=>{quitting=true;return {response:0};}});assert.equal(reloads,0);
 quitting=false;await diagnostics.offerReload(win,{surface:'hub',isQuitting:()=>quitting,showMessageBox:async()=>{destroyed=true;return {response:0};}});assert.equal(reloads,0);
 destroyed=false;await diagnostics.offerReload(win,{surface:'hub',isQuitting:()=>quitting,showMessageBox:async()=>({response:0})});assert.equal(reloads,1);
});
test('a transient idle state-save failure retries the latest state without provider work',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-reliability-'));const file=path.join(dir,'state.json');const {StateStore}=require('../desktop/core.cjs');const actual=new StateStore(file);let blocked=true,writes=0;
 const hub=hubFixture(t,{load:()=>({}),save:value=>{writes++;if(blocked)throw Error('fixture disk temporarily unavailable');actual.save(value);},close(){}});t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const calls=[];hub.client.request=async method=>{calls.push(method);throw Error('No provider work expected');};
 hub.state.settings.fixtureValue='first';hub.changed();t.mock.timers.tick(250);assert.equal(writes,1);assert.equal(fs.existsSync(file),false);
 hub.state.settings.fixtureValue='latest';blocked=false;t.mock.timers.tick(1000);assert.equal(actual.load().settings?.fixtureValue,'latest');assert.deepEqual(calls,[]);const saved=writes;t.mock.timers.tick(5000);assert.equal(writes,saved);
});
test('a persistent state-save failure has one bounded retry and shutdown cancels it',t=>{
 t.mock.timers.enable({apis:['setTimeout']});let blocked=true,writes=0;const hub=hubFixture(t,{load:()=>({}),save(){writes++;if(blocked)throw Error('fixture disk unavailable');},close(){}});
 hub.changed();t.mock.timers.tick(250);assert.equal(writes,1);t.mock.timers.tick(999);assert.equal(writes,1);t.mock.timers.tick(1);assert.equal(writes,2);t.mock.timers.tick(999);assert.equal(writes,2);blocked=false;hub.close();const closedWrites=writes;t.mock.timers.tick(10000);assert.equal(writes,closedWrites);
});
test('a valid provider message whose consumer fails is classified separately and disconnects uncertain work',t=>{
 const hub=hubFixture(t,{load:()=>({}),save(){},close(){}});const task={id:'t',projectId:'p',threadId:'thread',status:'working',crewId:'franky',messages:[]};hub.state.tasks.push(task);hub.gate.acquire(task.id,process.cwd());const events=[];hub.on('event',event=>events.push(event));const p=peer();hub.client.attach(p);hub.client.on('notification',()=>{throw Error('SECRET callback failure');});
 p.stdout.write('{"method":"fixture/event","params":{"prompt":"SECRET"}}\n');assert.equal(hub.client.connected,false);assert.equal(task.status,'unknown');assert.equal(hub.gate.active.has(task.id),true);assert.ok(events.some(e=>e.type==='diagnostic'&&e.data.event==='provider-handler-failed'));assert.ok(events.some(e=>e.type==='error'&&/handling/i.test(e.data.message)));assert.doesNotMatch(JSON.stringify(events.filter(e=>['diagnostic','error'].includes(e.type))),/SECRET|Unreadable/);
});
test('malformed protocol input emits a private-safe decode category and later messages still correlate',async()=>{
 const c=new CodexClient(),p=peer();c.attach(p);const entries=[];c.on('diagnostic',(message,details)=>entries.push({message,details}));const result=c.request('read');p.stdout.write('SECRET invalid JSON\n{"id":1,"result":"ready"}\n');assert.equal(await result,'ready');assert.equal(c.connected,true);assert.equal(entries[0].details?.event,'provider-decode-failed');assert.doesNotMatch(JSON.stringify(entries),/SECRET/);c.close();
});
test('an asynchronous provider consumer failure also disconnects with an uncertain pending request',async()=>{
 const c=new CodexClient(),p=peer();c.attach(p);const categories=[];c.on('diagnostic',(_message,details)=>categories.push(details?.event));c.on('notification',async()=>{throw Error('SECRET async failure');});
 const request=c.request('read');const rejected=assert.rejects(request,error=>error.code==='RPC_DISCONNECTED'&&error.uncertain===true);p.stdout.write('{"method":"fixture/event"}\n');await rejected;assert.equal(c.connected,false);assert.deepEqual(categories,['provider-handler-failed']);
});
test('failed persistence still blocks a provider dispatch even while save retry is scheduled',async t=>{
 let blocked=true;const hub=hubFixture(t,{load:()=>({}),save(){if(blocked)throw Error('fixture save failed');},close(){}});hub.client.connected=true;hub.state.codex.status='connected';const calls=[];hub.client.request=async method=>{calls.push(method);return {};};
 try{await assert.rejects(hub.start({projectId:'p',crewId:'franky',prompt:'fixture only'}),/fixture save failed/);assert.deepEqual(calls,[]);}finally{blocked=false;}
});
test('throwing diagnostic and disconnect observers cannot prevent transport cleanup',()=>{
 const c=new CodexClient(),p=peer();let killed=0;p.kill=()=>killed++;c.attach(p);c.on('notification',()=>{throw Error('consumer failed');});c.on('diagnostic',()=>{throw Error('diagnostic observer failed');});c.on('disconnected',()=>{throw Error('disconnect observer failed');});
 try{assert.doesNotThrow(()=>p.stdout.write('{"method":"fixture/event"}\n'));assert.equal(c.connected,false);assert.equal(c.child,null);assert.equal(killed,1);}finally{c.removeAllListeners('diagnostic');c.removeAllListeners('disconnected');c.close();}
});
test('a late rejected consumer from an old connection cannot disconnect its replacement',async()=>{
 const c=new CodexClient(),old=peer(),next=peer();let rejectOld,killed=0;next.kill=()=>killed++;c.attach(old);c.on('notification',()=>new Promise((_resolve,reject)=>{rejectOld=reject;}));old.stdout.write('{"method":"fixture/event"}\n');c.close();c.attach(next);
 rejectOld(Error('late old failure'));await new Promise(resolve=>setImmediate(resolve));try{assert.equal(c.connected,true);assert.equal(c.child,next);assert.equal(killed,0);}finally{c.close();}
});
test('asynchronously rejected diagnostic observers do not recurse or block disconnect',async()=>{
 const c=new CodexClient(),p=peer();c.attach(p);let reports=0;c.on('notification',()=>{throw Error('consumer failed');});c.on('diagnostic',async()=>{reports++;if(reports<3)throw Error('diagnostic failed');});p.stdout.write('{"method":"fixture/event"}\n');await new Promise(resolve=>setImmediate(resolve));assert.equal(c.connected,false);assert.equal(reports,1);c.close();
});
