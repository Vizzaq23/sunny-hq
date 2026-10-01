const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {createRequire}=require('node:module');
const {MissionBook}=require('../desktop/missions.cjs');
const profileFile=path.join(__dirname,'../desktop/mission-profile.cjs');
const profile=fs.existsSync(profileFile)?require(profileFile):{};
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-profile-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function original(){return {projects:[{id:'p',path:'fixture-project',custom:'keep'}],tasks:[{id:'t',status:'finished',projectId:'p',messages:[{id:'msg',role:'assistant',text:'Original reply\nwith Unicode ☀',time:10}]}],settings:{reducedMotion:true},futureField:{untouched:true},missionBook:{version:1,extra:'keep',missions:[{id:'m',projectId:'p',title:'Mission',objective:'Outcome',status:'COMPLETE',revision:4,acceptanceCriteria:['Reviewed'],completionBoundary:'review',activeAttemptId:'a',taskIds:['t'],attempts:[{id:'a',taskId:'t',taskIds:['t'],status:'finished'}],events:[],artifacts:[{id:'art',kind:'deliverable',attemptId:'a',path:'result.md',custom:'keep'}],acceptedAt:20,acceptance:{actor:'captain',attemptId:'a',criteria:[true],reviewedRevision:3}}]}};}
function baselineBook(){const source=execFileSync('git',['show','5b70fb2:desktop/missions.cjs'],{cwd:path.join(__dirname,'..'),encoding:'utf8'});const module={exports:{}};vm.runInNewContext(source,{require:createRequire(path.join(__dirname,'../desktop/missions.cjs')),module,structuredClone,Date,Set},{filename:'baseline-missions.cjs'});return module.exports.MissionBook;}
function startup(saved,backupDir){
 const source=fs.readFileSync(path.join(__dirname,'../desktop/main.cjs'),'utf8');let ready,hubStarts=0,writes=0,closed=0,error,exitCode;
 const store={load:()=>structuredClone(saved),save:()=>writes++,close:()=>closed++};
 const app={setName(){},setPath(){},getPath:()=>backupDir,getVersion:()=> 'fixture',requestSingleInstanceLock:()=>true,on(){},exit:code=>{exitCode=code;},whenReady:()=>({then:fn=>({catch:reject=>{ready=Promise.resolve().then(fn).catch(reject);}})})};
 const nativeRequire=createRequire(path.join(__dirname,'../desktop/main.cjs'));
 const requireStub=id=>{
  if(id==='electron')return {app,ipcMain:{handle(){}},dialog:{showErrorBox:(_title,message)=>{error=message;}}};
  if(id==='./core.cjs')return {StateStore:class {constructor(){return store;}},SqliteStore:class {constructor(){return store;}}};
  if(id==='./hub.cjs')return {Hub:class {constructor(){hubStarts++;throw Error('Hub should not start');}}};
  if(id==='./diagnostics.cjs')return {readBuildInfo:()=>({}),record(){}};
  return nativeRequire(id);
 };
 vm.runInNewContext(source,{require:requireStub,__dirname:path.join(__dirname,'../desktop'),process:{env:{SUNNY_DATA_DIR:backupDir,USERPROFILE:backupDir},argv:[],versions:{}},console:{error(){},warn(){}},setInterval,clearInterval,Map,Set,URL},{filename:'main-profile-fixture.cjs'});
 return {done:async()=>{await ready;return {hubStarts,writes,closed,error,exitCode};}};
}
test('v1_upgrade_preserves_tasks_and_legacy_acceptance',t=>{
 const dir=fixture(t),saved=original(),before=structuredClone(saved);
 assert.equal(typeof profile.inspectMissionProfile,'function');assert.deepEqual(profile.inspectMissionProfile(saved),{mode:'v1-upgrade'});
 const receipt=profile.writeVerifiedBackup(saved,dir),upgraded=profile.upgradeMissionProfile(saved,receipt);
 assert.equal(upgraded.missionBook.version,2);assert.deepEqual(upgraded.tasks,before.tasks);assert.deepEqual(upgraded.projects,before.projects);
 assert.deepEqual(upgraded.missionBook.missions[0].artifacts,before.missionBook.missions[0].artifacts);
 assert.deepEqual(upgraded.futureField,before.futureField);assert.equal(upgraded.missionBook.extra,'keep');
 assert.deepEqual(upgraded.missionBook.missions[0].acceptance,{...before.missionBook.missions[0].acceptance,legacy:true});
 assert.equal(upgraded.missionBook.missions[0].selectedResult,undefined);assert.deepEqual(saved,before);
 assert.deepEqual(upgraded.missionBook.workspace,{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]});
 assert.equal(receipt.sha256,crypto.createHash('sha256').update(fs.readFileSync(receipt.path)).digest('hex'));
 assert.doesNotThrow(()=>new MissionBook(upgraded.missionBook));
});
test('backup_failure_writes_nothing',async t=>{
 const dir=fixture(t);fs.writeFileSync(path.join(dir,'mission-profile-backups'),'not a directory');
 const result=await startup(original(),dir).done();const writesAfterBackupFailure=result.writes;
 assert.equal(writesAfterBackupFailure,0);assert.equal(result.hubStarts,0);assert.match(result.error,/backup|directory|ENOTDIR|EEXIST/i);assert.equal(result.closed,1);
});
test('unknown_version_never_starts_hub',async t=>{
 const dir=fixture(t),saved=original();saved.missionBook.version=99;const before=structuredClone(saved);
 const result=await startup(saved,dir).done();assert.equal(result.hubStarts,0);assert.equal(result.writes,0);assert.match(result.error,/Unsupported|recovery|compatible/i);assert.deepEqual(saved,before);assert.equal(result.closed,1);
});
test('old_reader_rejects_v2_before_save',t=>{
 assert.equal(typeof profile.upgradeMissionProfile,'function');const saved=original(),upgraded=profile.upgradeMissionProfile(saved,profile.writeVerifiedBackup(saved,fixture(t))),BaselineMissionBook=baselineBook();let saves=0;
 assert.throws(()=>{new BaselineMissionBook(upgraded.missionBook);saves++;},/Unsupported/);assert.equal(saves,0);
});
test('backup_tampering_or_different_state_cannot_authorize_upgrade',t=>{
 assert.equal(typeof profile.writeVerifiedBackup,'function');const dir=fixture(t),saved=original(),receipt=profile.writeVerifiedBackup(saved,dir);
 const changed=structuredClone(saved);changed.tasks[0].messages[0].text='changed';assert.throws(()=>profile.upgradeMissionProfile(changed,receipt),/backup|receipt|match|verified/i);
 fs.appendFileSync(receipt.path,' ');assert.throws(()=>profile.upgradeMissionProfile(saved,receipt),/backup|receipt|match|verified/i);
 assert.throws(()=>profile.upgradeMissionProfile(saved,{...receipt,sha256:'0'.repeat(64)}),/backup|receipt|match|verified/i);
});
test('fresh_profiles_create_v2_without_backup_and_store_preserves_unknown_fields',t=>{
 assert.equal(typeof profile.prepareMissionProfileStore,'function');const dir=fixture(t),saved={futureField:{keep:true},tasks:[]},writes=[];
 const store=profile.prepareMissionProfileStore({load:()=>saved,save:data=>writes.push(data),close(){}},dir);
 assert.deepEqual(profile.inspectMissionProfile(saved),{mode:'empty'});assert.equal(new MissionBook(store.load().missionBook).data.version,2);assert.deepEqual(fs.readdirSync(dir),[]);
 store.save({tasks:[{id:'new'}],missionBook:new MissionBook().data});assert.deepEqual(writes[0].futureField,saved.futureField);assert.deepEqual(writes[0].tasks,[{id:'new'}]);
});
test('mission_book_rejects_v1_and_malformed_workspace_authority',()=>{
 assert.throws(()=>new MissionBook(original().missionBook),/Unsupported/);
 const empty={version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]};
 for(const workspace of [{...empty,revision:-1},{...empty,version:2},{...empty,drafts:Array(51).fill({})},{...empty,seenAcceptanceIds:Array(501).fill('x')},{...empty,context:{projectId:'p',surface:'terminal',returnTo:{view:'home'}}}])assert.throws(()=>new MissionBook({version:2,missions:[],workspace}),/workspace|saved|Invalid/i);
});
test('malformed_authority_and_unknown_versions_are_preserved_as_unsupported',()=>{
 assert.equal(typeof profile.inspectMissionProfile,'function');
 for(const change of [saved=>{saved.missionBook.version=0;},saved=>{saved.missionBook.missions[0].acceptance.actor='agent';},saved=>{saved.missionBook.missions[0].acceptance.attemptId='foreign';},saved=>{saved.missionBook.missions[0].revision=-1;}]){const saved=original();change(saved);const before=structuredClone(saved);assert.deepEqual(profile.inspectMissionProfile(saved),{mode:'unsupported'});assert.deepEqual(saved,before);}
});
test('verified_backup_is_exclusive_and_preserves_exact_full_state_bytes',t=>{
 const saved=original(),dir=fixture(t),first=profile.writeVerifiedBackup(saved,dir),second=profile.writeVerifiedBackup(saved,dir);
 assert.notEqual(first.path,second.path);assert.equal(fs.readFileSync(first.path,'utf8'),JSON.stringify(saved,null,2));assert.equal(fs.readFileSync(second.path,'utf8'),JSON.stringify(saved,null,2));
});
test('failed_backup_write_or_readback_never_saves_application_state',t=>{
 const source=fs.readFileSync(profileFile,'utf8'),nativeRequire=createRequire(profileFile);
 for(const failure of ['write','readback']){
  const dir=fixture(t),saved=original(),before=structuredClone(saved);let writes=0;
  const failingFs={...fs,writeFileSync:(file,bytes)=>{if(failure==='write')throw Error('Fixture disk full');return fs.writeFileSync(file,bytes);},readFileSync:file=>failure==='readback'?Buffer.from('corrupt fixture backup'):fs.readFileSync(file)};
  const module={exports:{}};vm.runInNewContext(source,{module,require:id=>id==='node:fs'?failingFs:nativeRequire(id),structuredClone,Buffer,Date,Set},{filename:'profile-backup-failure-fixture.cjs'});
  assert.throws(()=>module.exports.prepareMissionProfileStore({load:()=>saved,save:()=>writes++,close(){}},dir),/disk full|backup/i);assert.equal(writes,0);assert.deepEqual(saved,before);
 }
});
test('v1_store_upgrade_is_deferred_until_a_verified_first_save_and_remains_v2_on_reload',t=>{
 const dir=fixture(t),saved=original(),writes=[];const adapter=profile.prepareMissionProfileStore({load:()=>saved,save:value=>writes.push(structuredClone(value)),close(){}},dir);
 assert.equal(writes.length,0);assert.equal(adapter.load().missionBook.version,2);assert.equal(fs.readdirSync(dir).length,1);
 adapter.save({missionBook:adapter.load().missionBook,tasks:adapter.load().tasks});assert.equal(writes.length,1);assert.deepEqual(writes[0].futureField,saved.futureField);
 const next=profile.prepareMissionProfileStore({load:()=>writes[0],save(){},close(){}},dir);assert.equal(next.load().missionBook.version,2);assert.equal(fs.readdirSync(dir).length,1);
});
test('workspace_limit_checks_preserve_current_input_and_accept_exact_boundaries',()=>{
 const draft={id:'d',kind:'brief',projectId:'p',title:'t'.repeat(200),text:'x'.repeat(50000),criteria:Array(20).fill('c'.repeat(2000)),completionBoundary:'review',revision:0,updatedAt:0};
 const workspace={version:1,revision:0,context:{projectId:'p',surface:'franky',returnTo:{view:'missions',projectId:'p'}},drafts:[draft],seenAcceptanceIds:Array.from({length:500},(_,index)=>'receipt-'+index)};
 assert.doesNotThrow(()=>new MissionBook({version:2,missions:[],workspace}));
 for(const change of [value=>{value.drafts[0].text+='x';},value=>{value.drafts[0].title+='t';},value=>{value.drafts[0].criteria.push('more');},value=>{value.drafts[0].criteria[0]+='c';},value=>{value.drafts[0].model='forbidden';},value=>{value.drafts=Array.from({length:12},(_,index)=>({...structuredClone(draft),id:'d'+index}));}]){
  const invalid=structuredClone(workspace);change(invalid);const before=structuredClone(invalid);assert.throws(()=>new MissionBook({version:2,missions:[],workspace:invalid}),/workspace/i);assert.deepEqual(invalid,before);
 }
});
test('v2_inspection_rejects_forged_modern_acceptance_and_accepts_legacy_receipt',t=>{
 const saved=original(),upgraded=profile.upgradeMissionProfile(saved,profile.writeVerifiedBackup(saved,fixture(t)));assert.deepEqual(profile.inspectMissionProfile(upgraded),{mode:'v2'});
 const mission=upgraded.missionBook.missions[0];delete mission.acceptance.legacy;assert.deepEqual(profile.inspectMissionProfile(upgraded),{mode:'unsupported'});
});
test('saved_requested_changes_are_bounded_to_50000_code_units',()=>{
 const saved=original();saved.missionBook.missions[0].attempts[0].requestedChanges='c'.repeat(50000);assert.deepEqual(profile.inspectMissionProfile(saved),{mode:'v1-upgrade'});
 saved.missionBook.missions[0].attempts[0].requestedChanges+='c';assert.deepEqual(profile.inspectMissionProfile(saved),{mode:'unsupported'});
});
test('backup_deleted_or_changed_before_first_upgraded_save_keeps_store_untouched',t=>{
 for(const change of ['delete','tamper']){
  const dir=fixture(t),saved=original();let writes=0;const adapter=profile.prepareMissionProfileStore({load:()=>saved,save:()=>writes++,close(){}},dir);const file=path.join(dir,fs.readdirSync(dir)[0]);
  if(change==='delete')fs.unlinkSync(file);else fs.appendFileSync(file,'changed');
  assert.throws(()=>adapter.save({missionBook:adapter.load().missionBook}),/ENOENT|backup|receipt/i);assert.equal(writes,0);
 }
});
test('malformed_mission_status_membership_and_completion_authority_fail_closed',()=>{
 for(const change of [saved=>{delete saved.missionBook.missions[0].taskIds;},saved=>{saved.missionBook.missions[0].status='invented';},saved=>{saved.missionBook.missions[0].projectId='';},saved=>{saved.missionBook.missions[0].attempts[0].taskIds=[];},saved=>{saved.missionBook.missions[0].taskIds=[];},saved=>{saved.missionBook.missions[0].attempts[0].status='invented';},saved=>{delete saved.missionBook.missions[0].acceptance;},saved=>{saved.missionBook.missions[0].attempts.push({id:'other',taskId:'t',taskIds:['t'],status:'finished'});saved.missionBook.missions[0].activeAttemptId='other';}]){
  const saved=original();change(saved);const before=structuredClone(saved);assert.deepEqual(profile.inspectMissionProfile(saved),{mode:'unsupported'});assert.deepEqual(saved,before);
 }
});
test('duplicate_mission_ids_fail_closed_even_across_projects',()=>{
 const saved=original();saved.missionBook.missions.push({...structuredClone(saved.missionBook.missions[0]),projectId:'other'});assert.deepEqual(profile.inspectMissionProfile(saved),{mode:'unsupported'});
 const book=structuredClone(saved.missionBook);book.version=2;book.workspace=profile.emptyWorkspace();for(const mission of book.missions)mission.acceptance.legacy=true;
 assert.throws(()=>new MissionBook(book),/duplicate|identity/i);
});
test('sparse_workspace_arrays_are_rejected_before_serialization_without_mutating_input',()=>{
 const draft={id:'d',kind:'brief',projectId:'p',text:'keep this',criteria:['criterion'],revision:0,updatedAt:1};
 for(const change of [workspace=>{workspace.drafts=[{...draft,criteria:Array(1)}];},workspace=>{workspace.seenAcceptanceIds=Array(1);},workspace=>{workspace.drafts=Array(1);}]){
  const workspace=profile.emptyWorkspace();change(workspace);const before=structuredClone(workspace);
  assert.throws(()=>profile.validateWorkspace(workspace),/workspace/i);assert.deepEqual(workspace,before);
 }
 const valid={...profile.emptyWorkspace(),drafts:[draft],seenAcceptanceIds:['receipt']};profile.validateWorkspace(valid);profile.validateWorkspace(JSON.parse(JSON.stringify(valid)));
});
test('sparse_mission_membership_and_acceptance_arrays_are_rejected_before_backup',()=>{
 for(const change of [mission=>{mission.taskIds=['t',,];},mission=>{mission.attempts[0].taskIds=['t',,];},mission=>{mission.acceptance.criteria=Array(1);},mission=>{mission.acceptanceCriteria=Array(1);},mission=>{mission.events=Array(1);},mission=>{mission.artifacts=Array(1);},mission=>{mission.seenEventIds=Array(1);}]){
  const saved=original();change(saved.missionBook.missions[0]);const before=structuredClone(saved);
  assert.deepEqual(profile.inspectMissionProfile(saved),{mode:'unsupported'});assert.deepEqual(saved,before);
 }
});
