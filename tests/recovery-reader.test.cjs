const {test}=require('node:test'),assert=require('node:assert/strict');
const fixture=()=>require('../desktop/packaged-acceptance.cjs').loadFrozenFixture(1);
const reader=()=>require('../desktop/recovery-reader.cjs');
const archive=Buffer.from(JSON.stringify([{id:'chatgpt:saved',title:'Saved history',projectName:'Local',external:true,status:'saved',messages:[{id:'m',role:'user',text:'Full imported history 🌊'.repeat(30000)}],opaque:{retain:true}}]));
test('reader retains complete final-v3 raw image and pages every transcript without source or authority changes',async()=>{
 const state=fixture();state.opaque={middle:['retain',null,{value:'never project'}]};const raw=Buffer.from(JSON.stringify(state)),before=Buffer.from(raw);
 const service=reader().createRecoverySnapshot({raw,archiveBytes:archive,archiveStatus:'present-verified',epoch:'first',buildIdentity:'a'.repeat(64)});
 const snapshot=await service.query('snapshot',{});assert.equal(snapshot.recovery.finalSourceVerification,'pending-close');assert.equal(snapshot.recovery.mode,'recovery-reader');assert.equal(snapshot.opaque,undefined);
 assert.deepEqual(await service.query('workspace:get',{}),state.missionBook.workspace);
 for(const task of state.tasks){let cursor,complete=false,reconstructed=new Map();while(!complete){const page=await service.query('transcript:page',{projectId:task.projectId,taskId:task.id,epoch:'first',revision:1,direction:'newer',limit:3,...(cursor?{cursor}:{})});for(const segment of page.segments){const previous=reconstructed.get(segment.messageId)||'';assert.equal(segment.offset,previous.length);reconstructed.set(segment.messageId,previous+segment.text);}complete=page.complete;cursor=page.nextCursor;}assert.deepEqual([...reconstructed],task.messages.map(m=>[m.id,m.text]));}
 assert.deepEqual(service.retainedImage(),{raw:before,state,archiveRaw:archive});assert.deepEqual(raw,before);service.close();assert.throws(()=>service.query('snapshot',{}),{code:'RECOVERY_CLOSED'});
});
test('reader local archive is full, bounded and never falls back to remote history',async()=>{
 const service=reader().createRecoverySnapshot({raw:Buffer.from(JSON.stringify(fixture())),archiveBytes:archive,archiveStatus:'present-verified',epoch:'archive',buildIdentity:'b'.repeat(64)});
 assert.equal((await service.query('task:history',{})).imported[0].id,'chatgpt:saved');let request={threadId:'chatgpt:saved',direction:'newer'},text='';for(;;){const page=await service.query('task:readExternalPage',request);text+=page.segments.map(s=>s.text).join('');if(page.complete)break;request={...request,sessionId:page.sessionId,revision:page.revision,cursor:page.nextCursor};}assert.equal(text,JSON.parse(archive)[0].messages[0].text);
 await assert.rejects(service.query('task:readExternalPage',{threadId:'remote'}),{code:'RECOVERY_QUERY_INVALID'});
 for(const action of ['workspace:update','workspace:claimAcceptanceCue','task:start','run:control','mission:resultStatus','result:play','provider:status','terminal:create','sunny:invoke'])assert.throws(()=>service.query(action,{}),{code:'RECOVERY_READ_ONLY'});
 assert.throws(()=>service.query('snapshot',{action:'task:start'}),{code:'RECOVERY_QUERY_INVALID'});
});
test('schema and archive failure do not manufacture defaults or migrated images',()=>{
 const input={raw:Buffer.from(JSON.stringify(fixture())),archiveStatus:'absent-at-epoch',epoch:'e',buildIdentity:'c'.repeat(64)};
 for(const state of [{},{missionBook:{version:9}},(()=>{const s=fixture();s.missionBook.version=2;delete s.missionBook.runs;return s;})()])assert.throws(()=>reader().createRecoverySnapshot({...input,raw:Buffer.from(JSON.stringify(state))}));
 assert.throws(()=>reader().createRecoverySnapshot({...input,archiveStatus:'present-verified'}));assert.throws(()=>reader().createRecoverySnapshot({...input,archiveBytes:archive}));
 const first=reader().createRecoverySnapshot(input),second=reader().createRecoverySnapshot({...input,epoch:'new'}),task=fixture().tasks[0];assert.equal(second.query('transcript:page',{projectId:task.projectId,taskId:task.id,epoch:'e',revision:1,direction:'newer'}).stale,true);assert.deepEqual(first.query('task:history',{}).imported,[]);
});
test('forged admission and direct entry cannot import storage or normal runtime',()=>{
 const Module=require('node:module'),original=Module._load,loads=[];Module._load=function(name,...rest){loads.push(name);return original.call(this,name,...rest);};try{assert.throws(()=>reader().openRecoveryReader({}),{code:'RECOVERY_LAUNCH_NOT_ADMITTED'});}finally{Module._load=original;}assert.equal(loads.some(n=>/hub\.cjs|node:sqlite|catalog\.cjs|ordered-store/.test(n)),false);
});
test('fixed SQLite adapter closes the connection on every reachable read/schema failure',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../desktop/recovery-reader.cjs'),'utf8');
 for(const stage of ['BEGIN','schema','version','rows','COMMIT','invalid-profile','close']){
  let closed=0;class Database {exec(sql){if(sql===stage)throw Error('INJECTED');}prepare(sql){return {all(){if(sql.includes('sqlite_schema')){if(stage==='schema')throw Error('INJECTED');return [{type:'table',name:'state',tbl_name:'state',sql:'CREATE TABLE state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)'}];}if(stage==='rows')throw Error('INJECTED');return [{id:1,kind:'text',value:stage==='invalid-profile'?'{}':JSON.stringify(fixture())}];},get(){if(stage==='version')throw Error('INJECTED');return {user_version:0,application_id:0,encoding:'UTF-8'};}};}close(){closed++;if(stage==='close')throw Error('INJECTED');}}
  const sandbox={module:{exports:{}},Buffer,structuredClone,require(name){if(name==='./recovery-reader-guard.cjs')return {assertAdmission(){}};if(name==='node:sqlite')return {DatabaseSync:Database};if(name.startsWith('./'))return require('../desktop/'+name.slice(2));return require(name);}};vm.runInNewContext(source,sandbox);assert.throws(()=>sandbox.module.exports.openRecoveryReader({sourceFormat:'sqlite',sqlitePath:'fixed-test-only',archiveStatus:'absent-at-epoch',epoch:'e',buildIdentity:'a'.repeat(64)}));assert.equal(closed,1,stage);
 }
});
test('saved project roots are inert strings and managed final-v3 authority survives reader queries',async t=>{
 const prepared=await require('./helpers/run-control-fixture.cjs').fixture(t),state=structuredClone(prepared.stored),raw=Buffer.from(JSON.stringify(state));
 const Module=require('node:module'),original=Module._load,forbidden=[];Module._load=function(name,...rest){if(/(?:^|\/)(hub|catalog|codex|captain|ordered-store|persistence-worker)\.cjs$/.test(name)){forbidden.push(name);throw Error('FORBIDDEN_RUNTIME');}return original.call(this,name,...rest);};
 try{const service=reader().createRecoverySnapshot({raw,archiveStatus:'absent-at-epoch',epoch:'managed',buildIdentity:'f'.repeat(64)});const snapshot=service.query('snapshot',{});for(const run of state.missionBook.runs){const result=service.query('run:inspect',{projectId:run.projectId,runId:run.id});assert.deepEqual(result.saved,run);}assert.deepEqual(service.retainedImage().state,state);assert.equal(snapshot.recovery.capabilities.dispatch,false);service.close();}finally{Module._load=original;}
 assert.deepEqual(forbidden,[]);
});
