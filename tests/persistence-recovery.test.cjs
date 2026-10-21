const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {Worker}=require('node:worker_threads');
const {EventEmitter}=require('node:events');
const {openOrderedStore}=require('../desktop/ordered-store.cjs');
const {Hub}=require('../desktop/hub.cjs');
const {MissionBook}=require('../desktop/missions.cjs');
const {receiptStore}=require('./helpers/receipt-store.cjs');
test('shutdown quiesces scheduler before draining required receipts and never writes after uncertain flush',async t=>{const f=await require('./helpers/run-control-fixture.cjs').fixture(t),events=[];f.hub.scheduler();const barrier=f.hub.store.barrier;f.hub.store.barrier=async(image,reason)=>{events.push(reason);return barrier(image,reason);};f.hub.store.flush=async()=>{assert.equal(f.hub.scheduler().closed,true);throw Object.assign(Error('lost shutdown flush'),{code:'COMMIT_UNCERTAIN',uncertain:true});};await assert.rejects(f.hub.close(),/lost shutdown flush/);assert.equal(events.includes('shutdown'),false);assert.equal(f.hub.closed,undefined);assert.equal(f.hub.state.persistence.uncertain,true);});
const lifecycle=()=>require('../desktop/persistence-lifecycle.cjs');
const sha=text=>createHash('sha256').update(text).digest('hex');
function fixture(t,kind='sqlite'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-recovery-')),stores=[],hubs=[],workers=[];
 t.after(async()=>{await Promise.allSettled(hubs.map(hub=>hub.close()));await Promise.allSettled(stores.map(store=>store.close()));await Promise.allSettled(workers.map(worker=>worker.terminate()));fs.rmSync(dir,{recursive:true,force:true});});
 const options={kind,file:path.join(dir,kind==='sqlite'?'sunny.sqlite':'state.json'),backupDir:path.join(dir,'mission-profile-backups')};
 return {dir,options,stores,hubs,workers};
}
async function open(f,extra={}){const store=await openOrderedStore({...f.options,...extra});f.stores.push(store);return store;}
function hubFor(f,store){
 const hub=new Hub({home:f.dir,store,catalog:{discoverProjects:()=>[{id:'p',name:'Fixture',path:f.dir}],discoverTools:()=>[],discoverAutomations:()=>[]}}),calls=[];
 hub.client.request=async method=>{calls.push(method);throw Error('Unexpected external call');};hub.client.connect=async()=>{calls.push('connect');throw Error('Unexpected external connection');};
 f.hubs.push(hub);return {hub,calls};
}
function acceptedProfile(f,{file=false}={}){
 const book=new MissionBook(),mission=book.create({projectId:'p',title:'Recovery fixture',objective:'Exact saved result',acceptanceCriteria:['Current content']});
 const attempt=book.begin(mission.id,mission.revision),text='Retained result \u{1f31e}',task={id:attempt.taskId,projectId:'p',crewId:'franky',status:'finished',messages:[{id:'reply',role:'assistant',text,time:1}]};book.sync([task],[]);
 let ref={kind:'reply',taskId:task.id,messageId:'reply',sha256:sha(text)};
 if(file){fs.writeFileSync(path.join(f.dir,'result.md'),text);mission.artifacts.push({id:'file',kind:'deliverable',attemptId:attempt.id,projectId:'p',producer:'fixture',filePath:'result.md',sha256:sha(text),recordedAt:1});ref={kind:'deliverable',artifactId:'file',sha256:sha(text)};}
 mission.selectedResult={id:'selected',attemptId:attempt.id,producerTaskId:task.id,ref,selectedAt:1};
 return {book,mission,task,profile:{projects:[{id:'p',name:'Fixture',path:f.dir}],tasks:[task],missionBook:book.data,opaque:{retained:'fixture'}}};
}
function intercept(f,{dieAt=1,hold=false}={}){
 let committedResolve,held,count=0,terminated=false;const committed=new Promise(resolve=>{committedResolve=resolve;});
 const factory=(file,options)=>{
  const worker=new Worker(file,options),bridge=new EventEmitter();f.workers.push(worker);
  bridge.postMessage=message=>worker.postMessage(message);bridge.terminate=async()=>{terminated=true;return worker.terminate();};
  worker.on('message',message=>{if(message.type==='committed'&&++count===dieAt){held=message;committedResolve(message);if(!hold)worker.terminate();return;}bridge.emit('message',message);});
  worker.on('error',error=>bridge.emit('error',error));worker.on('exit',code=>bridge.emit('exit',code));factory.release=()=>bridge.emit('message',held);return bridge;
 };
 return {factory,committed,release:()=>factory.release(),get terminated(){return terminated;}};
}
for(const kind of ['sqlite','json']){
 test('restart_preserves_every_acknowledged_barrier '+kind,{timeout:15000},async t=>{
  const f=fixture(t,kind),first=hubFor(f,await open(f));await first.hub.initializeRecovery();
  await first.hub.updateWorkspace({expectedRevision:0,draft:{id:'brief-p',kind:'brief',projectId:'p',title:'Draft',text:'Every character \u{1f31e}',criteria:['Retain'],completionBoundary:'review',revision:0,updatedAt:1}});
  const acknowledged=structuredClone(first.hub.state.workspace);await first.hub.close();const second=hubFor(f,await open(f));await second.hub.initializeRecovery();
  assert.deepEqual(second.hub.state.workspace,acknowledged);assert.deepEqual(second.calls,[]);assert.equal(second.hub.state.persistence.state,'saved');
 });
 test('worker_crash_retains_unknown_reservations_and_never_replays '+kind,{timeout:15000},async t=>{
  const f=fixture(t,kind),crash=intercept(f),first=hubFor(f,await open(f,{workerFactory:crash.factory}));
  first.hub.state.tasks.push({id:'unknown',projectId:'p',status:'working',messages:[{id:'draft',role:'user',text:'Unsaved latest text',time:1}]});first.hub.reserveWriter(first.hub.state.tasks[0]);first.hub.markDirty();
  await assert.rejects(first.hub.persist('dispatch'),error=>error.code==='COMMIT_UNCERTAIN');assert.equal(first.hub.state.persistence.uncertain,true);assert.equal(first.hub.gate.blocked(f.dir),true);
  await assert.rejects(first.hub.retryPersistence(),/restart|uncertain|recovery/i);assert.deepEqual(first.calls,[]);await assert.rejects(first.hub.close());
  const second=hubFor(f,await open(f));await second.hub.initializeRecovery();assert.equal(second.hub.state.tasks[0].status,'unknown');assert.equal(second.hub.gate.blocked(f.dir),true);assert.deepEqual(second.calls,[]);
 });
 test('final_acceptance_commit_crash_and_content_mismatch_restart_fences_audit '+kind,{timeout:15000},async t=>{
  const f=fixture(t,kind),data=acceptedProfile(f,{file:true}),seed=await open(f);await seed.barrier(data.profile,'mission');await seed.close();
  const crash=intercept(f,{dieAt:2}),first=hubFor(f,await open(f,{workerFactory:crash.factory})),live=first.hub.state.missions[0];
  await assert.rejects(first.hub.acceptMission({missionId:live.id,revision:live.revision,resultId:live.selectedResult.id,resultSha256:live.selectedResult.ref.sha256,criteria:[true]}),error=>error.code==='COMMIT_UNCERTAIN');
  fs.writeFileSync(path.join(f.dir,'result.md'),'Changed after final commit');await assert.rejects(first.hub.close());const second=hubFor(f,await open(f));await second.hub.initializeRecovery();
  const recovered=second.hub.missionBook.get(live.id);assert.equal(recovered.status,'COMPLETE');assert.ok(recovered.acceptance);assert.ok(recovered.acceptanceRecovery);assert.equal(second.hub.gate.blocked(f.dir),true);
  await assert.rejects(second.hub.claimAcceptanceCue({acceptanceId:recovered.acceptance.id}),/acceptance|recovery|unresolved/i);
  const {getMissionResultStatus}=require('../desktop/mission-result-status.cjs');assert.equal((await getMissionResultStatus({getState:()=>second.hub.state,readArtifact:artifact=>second.hub.readMissionResultArtifact(second.hub.project('p'),artifact)},{projectId:'p',missionId:recovered.id,revision:recovered.revision})).available,false);
  assert.deepEqual(second.calls,[]);await second.hub.close();const persisted=(await open(f)).load().missionBook.missions[0];assert.deepEqual(persisted.acceptance,recovered.acceptance);assert.deepEqual(persisted.acceptanceRecovery,recovered.acceptanceRecovery);
 });
 test('failed_boot_never_overwrites_unsupported_profile '+kind,{timeout:15000},async t=>{
  const f=fixture(t,kind),profile={missionBook:{version:77,missions:[]},opaque:'preserve'};
  if(kind==='json')fs.writeFileSync(f.options.file,JSON.stringify(profile));else{const {SqliteStore}=require('../desktop/core.cjs'),raw=new SqliteStore(f.options.file);raw.save(profile);raw.close();}
  const original=fs.readFileSync(f.options.file);await assert.rejects(lifecycle().openProfile({dataDir:f.dir}),/unsupported|invalid|profile/i);assert.deepEqual(fs.readFileSync(f.options.file),original);assert.equal(fs.existsSync(path.join(f.dir,kind==='sqlite'?'state.json':'sunny.sqlite')),false);
 });
}
test('shutdown_during_save_preserves_pending_drafts_and_closes_worker',{timeout:15000},async t=>{
 const f=fixture(t),gate=intercept(f,{hold:true}),store=await open(f,{workerFactory:gate.factory}),{hub}=hubFor(f,store);
 const task={id:'stream',projectId:'p',status:'unknown',messages:[{id:'m',role:'assistant',text:'Earlier stream',time:1}]};hub.state.tasks.push(task);hub.state.settings.captainDraft='Latest retained captain text \u{1f31e}';hub.markDirty();const close=hub.close();await gate.committed;assert.equal(hub.state.settings.captainDraft,'Latest retained captain text \u{1f31e}');assert.notEqual(hub.state.persistence.state,'saved');
 hub.state.settings.captainDraft+=' — newer while final save is pending';task.messages[0].text+=' and newer buffered text';hub.streamChanged(task);
 assert.strictEqual(hub.close(),close);gate.release();await close;assert.equal(gate.terminated,true);const saved=(await open(f)).load();assert.equal(saved.settings.captainDraft,hub.state.settings.captainDraft);assert.equal(saved.tasks[0].messages[0].text,task.messages[0].text);
});
test('disk_failure_storage_retry_has_zero_external_calls',{timeout:15000},async t=>{
 const f=fixture(t);let value={},blocked=true;const store=receiptStore({load:()=>structuredClone(value),save:image=>{if(blocked)throw Error('Fixture disk unavailable');value=structuredClone(image);},close(){}}),{hub,calls}=hubFor(f,store);
 hub.state.settings.captainDraft='Keep until durable';hub.markDirty();await assert.rejects(hub.persist('mission'),/disk unavailable/);blocked=false;await hub.retryPersistence();assert.equal(value.settings.captainDraft,'Keep until durable');assert.deepEqual(calls,[]);assert.equal(hub.state.persistence.state,'saved');
});
test('failed_shutdown_keeps_text_and_unsaved_health_available',{timeout:15000},async t=>{
 const f=fixture(t);let closed=0;const store=receiptStore({load:()=>({}),save:()=>{throw Error('Fixture disk unavailable');},close:()=>{closed++;}}),{hub}=hubFor(f,store);hub.state.settings.captainDraft='Copy or export this text';hub.markDirty();
 await assert.rejects(hub.close(),/disk unavailable/);assert.equal(hub.state.settings.captainDraft,'Copy or export this text');assert.equal(hub.state.persistence.state,'unsaved');assert.equal(closed,1);assert.notEqual(hub.closed,true);assert.equal(hub.quiescing,true);
 const task={id:'late',projectId:'p',status:'unknown',messages:[{id:'m',role:'assistant',text:'Buffered latest text',time:1}]};hub.state.tasks.push(task);const before=hub.dirtyGeneration;hub.streamChanged(task);assert.ok(hub.dirtyGeneration>before);assert.equal(task.messages[0].text,'Buffered latest text');assert.equal(hub.state.persistence.state,'unsaved');
});
test('before_quit_waits_and_is_idempotent_without_real_app',async()=>{
 let finish,shutdowns=0,closed=0,failed=0,prevented=0;const pending=new Promise(resolve=>{finish=resolve;}),quit=lifecycle().createQuitLifecycle({shutdown:()=>{shutdowns++;return pending;},onClosed:()=>{closed++;},onFailed:()=>{failed++;}}),event={preventDefault:()=>{prevented++;}};
 const first=quit.beforeQuit(event),second=quit.beforeQuit(event);assert.strictEqual(first,second);assert.equal(prevented,2);assert.equal(closed,0);finish();await first;assert.equal(shutdowns,1);assert.equal(closed,1);assert.equal(failed,0);quit.beforeQuit(event);assert.equal(prevented,2);
});
test('boot_waits_for_durable_restart_recovery_before_exposing_hub',{timeout:15000},async t=>{
 const f=fixture(t),seed=await open(f),image={projects:[{id:'p',name:'Fixture',path:f.dir}],tasks:[{id:'t',projectId:'p',status:'working',messages:[]}],missionBook:new MissionBook().data};await seed.barrier(image,'dispatch');await seed.close();
 const gate=intercept(f,{hold:true});let exposed=false;
 const boot=lifecycle().bootHub({dataDir:f.dir,home:f.dir,catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]},openStore:options=>open(f,{...options,workerFactory:gate.factory})}).then(hub=>{exposed=true;f.hubs.push(hub);return hub;});
 await gate.committed;assert.equal(exposed,false);gate.release();const hub=await boot;assert.equal(hub.state.tasks[0].status,'unknown');assert.equal(hub.state.persistence.state,'saved');await hub.close();assert.equal((await open(f)).load().tasks[0].status,'unknown');
});
test('failed_before_quit_never_claims_exit_and_repeated_events_share_failure',async()=>{
 let shutdowns=0,closed=0,failures=0,prevented=0;const quit=lifecycle().createQuitLifecycle({shutdown:async()=>{shutdowns++;throw Error('Final save unavailable');},onClosed:()=>{closed++;},onFailed:error=>{assert.match(error.message,/unavailable/);failures++;}}),event={preventDefault:()=>{prevented++;}};
 const first=quit.beforeQuit(event),second=quit.beforeQuit(event);assert.strictEqual(first,second);await first;assert.equal(shutdowns,1);assert.equal(closed,0);assert.equal(failures,1);quit.beforeQuit(event);assert.equal(prevented,3);
});
test('acceptance_recovery_fence_is_explicitly_validated_and_retains_audit',t=>{
 const f=fixture(t),data=acceptedProfile(f);data.book.accept(data.mission.id,data.mission.revision,[true],{resultId:'selected',attemptId:data.mission.activeAttemptId,producerTaskId:data.task.id,ref:data.mission.selectedResult.ref});
 const audit=structuredClone(data.mission.acceptance),valid={version:1,acceptanceId:audit.id,resultId:audit.resultId,resultSha256:audit.resultSha256,reason:'result-binding',detectedAt:1};data.mission.acceptanceRecovery=valid;
 assert.doesNotThrow(()=>new MissionBook(data.book.data));assert.deepEqual(data.mission.acceptance,audit);
 for(const invalid of [{...valid,acceptanceId:'other'},{...valid,resultSha256:'0'.repeat(64)},{...valid,reason:'execute-again'},{...valid,extra:true},{...valid,detectedAt:NaN}]){const changed=structuredClone(data.book.data);changed.missions[0].acceptanceRecovery=invalid;assert.throws(()=>new MissionBook(changed),/recovery|fence|acceptance/i);}
});
test('pending_acceptance_restart_restores_reservation_without_finishing_or_replaying',{timeout:15000},async t=>{
 const f=fixture(t),data=acceptedProfile(f),selected=data.mission.selectedResult;
 data.mission.pendingAcceptance={id:'saved-intent',attemptId:selected.attemptId,reviewedRevision:data.mission.revision,resultId:selected.id,resultSha256:selected.ref.sha256,producerTaskId:selected.producerTaskId,ref:structuredClone(selected.ref),criteria:[true],createdAt:1};
 const seed=await open(f);await seed.barrier(data.profile,'acceptance');await seed.close();const {hub,calls}=hubFor(f,await open(f));await hub.initializeRecovery();
 const mission=hub.missionBook.get(data.mission.id);assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.equal(mission.pendingAcceptance.id,'saved-intent');assert.equal(mission.acceptance,undefined);assert.equal(hub.gate.active.has('mission-accept:'+mission.id),true);
 await assert.rejects(hub.selectMissionResult({missionId:mission.id,revision:mission.revision,ref:selected.ref,producerTaskId:selected.producerTaskId}),/wait|pending|recovery|unresolved/i);assert.deepEqual(calls,[]);
});
test('native_terminal_store_failure_retry_rejects_and_preserves_acknowledged_profile',{timeout:15000},async t=>{
 const f=fixture(t,'json'),seed=await open(f),data=acceptedProfile(f);await seed.barrier(data.profile,'mission');await seed.close();const {hub,calls}=hubFor(f,await open(f));
 const original=fs.readFileSync(f.options.file);hub.state.settings.captainDraft='Retain newer live text';hub.state.workspace.revision=-1;hub.markDirty();await assert.rejects(hub.persist('workspace'),error=>error.code==='STORE_FAILED');
 await assert.rejects(hub.retryPersistence(),/restart|export/i);assert.deepEqual(fs.readFileSync(f.options.file),original);assert.equal(hub.state.settings.captainDraft,'Retain newer live text');assert.deepEqual(calls,[]);await assert.rejects(hub.close());assert.notEqual(hub.closed,true);
});
test('dual_existing_formats_fail_closed_without_choosing_by_timestamp',{timeout:15000},async t=>{
 const f=fixture(t),seed=await open(f);await seed.barrier({missionBook:new MissionBook().data,opaque:'older SQLite'},'mission');await seed.close();const json=path.join(f.dir,'state.json');fs.writeFileSync(json,JSON.stringify({missionBook:new MissionBook().data,opaque:'newer JSON'}));
 const originalSqlite=fs.readFileSync(f.options.file),originalJson=fs.readFileSync(json);await assert.rejects(lifecycle().openProfile({dataDir:f.dir}),/both|ambig|format|compatible/i);assert.deepEqual(fs.readFileSync(f.options.file),originalSqlite);assert.deepEqual(fs.readFileSync(json),originalJson);
});
test('opaque_external_intents_restore_even_terminal_captain_reservations_and_never_replay',{timeout:15000},async t=>{
 for(const field of ['toolDispatchIntent','replacementThreadIntent','approvalResponseIntent']){
  const f=fixture(t,'json'),seed=await open(f),task={id:field,projectId:'p',captain:true,status:'finished',threadId:'saved-thread',messages:[],[field]:{id:'retained-intent'}};
  await seed.barrier({projects:[{id:'p',name:'Fixture',path:f.dir}],tasks:[task],missionBook:new MissionBook().data},'dispatch');await seed.close();const {hub,calls}=hubFor(f,await open(f));await hub.initializeRecovery();const current=hub.task(task.id);
  assert.equal(current.status,'unknown');assert.equal(hub.gate.blocked(f.dir),true);assert.deepEqual(current[field],task[field]);await assert.rejects(hub.reconcile(current),/intent|unresolved|recovery/i);assert.equal(hub.gate.blocked(f.dir),true);assert.deepEqual(calls,[]);
 }
});
test('submitted_approval_audit_does_not_turn_finished_task_into_unresolved_work',{timeout:15000},async t=>{
 const f=fixture(t,'json'),seed=await open(f),audit={id:'approval-audit',state:'submitted',submittedAt:1},task={id:'finished',projectId:'p',status:'finished',messages:[],approvalResponseIntent:audit};
 await seed.barrier({projects:[{id:'p',name:'Fixture',path:f.dir}],tasks:[task],missionBook:new MissionBook().data},'mission');await seed.close();const {hub,calls}=hubFor(f,await open(f));await hub.initializeRecovery();assert.equal(hub.task(task.id).status,'finished');assert.deepEqual(hub.task(task.id).approvalResponseIntent,audit);assert.equal(hub.gate.blocked(f.dir),false);assert.deepEqual(calls,[]);
});
test('startup_rechecks_complete_binding_after_awaited_recovery_save',{timeout:15000},async t=>{
 const f=fixture(t),data=acceptedProfile(f,{file:true});data.book.accept(data.mission.id,data.mission.revision,[true],{resultId:'selected',attemptId:data.mission.activeAttemptId,producerTaskId:data.task.id,ref:data.mission.selectedResult.ref});const seed=await open(f);await seed.barrier(data.profile,'acceptance');await seed.close();
 const gate=intercept(f,{hold:true}),{hub,calls}=hubFor(f,await open(f,{workerFactory:gate.factory}));let ready=false;const startup=hub.initializeRecovery().then(()=>{ready=true;});await gate.committed;assert.equal(ready,false);fs.writeFileSync(path.join(f.dir,'result.md'),'Drift during startup receipt wait');gate.release();await startup;
 assert.ok(hub.missionBook.get(data.mission.id).acceptanceRecovery);assert.equal(hub.state.persistence.state,'saved');assert.deepEqual(calls,[]);await hub.close();assert.ok((await open(f)).load().missionBook.missions[0].acceptanceRecovery);
});
test('unsupported_delete_journal_sqlite_boot_preserves_exact_bytes',{timeout:15000},async t=>{
 const f=fixture(t),{DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(f.options.file);db.exec('PRAGMA journal_mode=DELETE; CREATE TABLE state (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES (1,?)').run(JSON.stringify({missionBook:{version:99,missions:[]}}));db.close();const original=fs.readFileSync(f.options.file);
 await assert.rejects(lifecycle().openProfile({dataDir:f.dir}),/unsupported|invalid|profile/i);assert.deepEqual(fs.readFileSync(f.options.file),original);
});
test('malformed_json_boot_refuses_defaults_and_preserves_original',{timeout:15000},async t=>{
 const f=fixture(t,'json');fs.writeFileSync(f.options.file,'{ malformed profile');const original=fs.readFileSync(f.options.file),opening=lifecycle().openProfile({dataDir:f.dir}).then(store=>{f.stores.push(store);return store;});
 await assert.rejects(opening,/profile|JSON|invalid|malformed/i);assert.deepEqual(fs.readFileSync(f.options.file),original);
});
test('branch_switch_rechecks_quiesce_after_awaited_source_read',async()=>{
 const {MissionBranch}=require('../desktop/mission-branch.cjs');let resolve,stopped=false,calls=0,reads=0;const source={commit:'a',fingerprint:'f',branch:'base',dirty:false},plan={baseFingerprint:'f',baseCommit:'a',name:'codex/sunny-fixture'};
 const service=new MissionBranch({gitState:async()=>++reads===1?new Promise(yes=>{resolve=yes;}):{...source,branch:plan.name},command:async()=>{calls++;}}),pending=service.create('fixture',plan,()=>{if(stopped)throw Error('Sunny is stopping.');});await new Promise(setImmediate);stopped=true;resolve(source);await assert.rejects(pending,/stopping/);assert.equal(calls,0);
});
test('check_process_rechecks_quiesce_after_awaited_source_read',async t=>{
 const f=fixture(t),{MissionEvidence}=require('../desktop/mission-evidence.cjs');fs.writeFileSync(path.join(f.dir,'package.json'),JSON.stringify({scripts:{test:'synthetic'}}));let resolve,stopped=false,calls=0,reads=0;const source={commit:'a',fingerprint:'f',branch:'base',dirty:false},service=new MissionEvidence();
 service.gitState=async()=>++reads===1?new Promise(yes=>{resolve=yes;}):source;service.runtime=()=>({node:'synthetic',npm:'synthetic'});service.execute=async()=>{calls++;return {exitCode:0};};const pending=service.runCheck(f.dir,'test',()=>{if(stopped)throw Error('Sunny is stopping.');});await new Promise(setImmediate);stopped=true;resolve(source);await assert.rejects(pending,/stopping/);assert.equal(calls,0);
});
test('publication_push_rechecks_quiesce_after_internal_validation',async()=>{
 const {MissionPublisher}=require('../desktop/mission-publisher.cjs');let resolve,stopped=false;const calls=[],source={branch:'codex/sunny-fixture',commit:'a',fingerprint:'f',dirty:false},preview={...source,repository:'crew/sunny',base:'main',title:'Synthetic',body:'Synthetic'};
 const service=new MissionPublisher({evidence:{gitState:async()=>new Promise(yes=>{resolve=yes;}),command:async()=> 'https://github.com/crew/sunny.git'},run:async(_exe,args)=>{calls.push(args);return args[0]==='pr'?'https://github.com/crew/sunny/pull/1':'';}}),pending=service.publish('fixture',preview,()=>{if(stopped)throw Error('Sunny is stopping.');});await new Promise(setImmediate);stopped=true;resolve(source);await assert.rejects(pending,/stopping/);assert.deepEqual(calls,[]);
});
test('publication_pr_rechecks_quiesce_after_push_without_replaying',async()=>{
 const {MissionPublisher}=require('../desktop/mission-publisher.cjs');let resolve,started,stopped=false;const pushed=new Promise(yes=>{started=yes;}),calls=[],source={branch:'codex/sunny-fixture',commit:'a',fingerprint:'f',dirty:false},preview={...source,repository:'crew/sunny',base:'main',title:'Synthetic',body:'Synthetic'};
 const service=new MissionPublisher({evidence:{gitState:async()=>source,command:async()=> 'https://github.com/crew/sunny.git'},run:async(_exe,args)=>{calls.push(args);if(args[0]==='push'){started();return new Promise(yes=>{resolve=yes;});}return 'https://github.com/crew/sunny/pull/1';}}),pending=service.publish('fixture',preview,()=>{if(stopped)throw Error('Sunny is stopping.');});await pushed;stopped=true;resolve('');await assert.rejects(pending,error=>/stopping/.test(error.message)&&error.uncertain===true);assert.equal(calls.length,1);assert.equal(calls[0][0],'push');
});
test('existing_foreign_sqlite_and_empty_json_boot_never_create_authority_defaults',{timeout:15000},async t=>{
 const f=fixture(t),{DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(f.options.file);db.exec('CREATE TABLE unrelated (value TEXT)');db.close();const original=fs.readFileSync(f.options.file);await assert.rejects(lifecycle().openProfile({dataDir:f.dir}),/unsupported|profile|state/i);assert.deepEqual(fs.readFileSync(f.options.file),original);
 const json=fixture(t,'json');fs.writeFileSync(json.options.file,'');await assert.rejects(lifecycle().openProfile({dataDir:json.dir}),/unsupported|profile|JSON/i);assert.equal(fs.readFileSync(json.options.file,'utf8'),'');
});
test('new_missing_profiles_bootstrap_and_supported_delete_journal_keeps_exact_data',{timeout:15000},async t=>{
 const fresh=fixture(t),newStore=await lifecycle().openProfile({dataDir:fresh.dir});fresh.stores.push(newStore);assert.deepEqual(newStore.load(),{});await newStore.close();assert.equal(fs.existsSync(path.join(fresh.dir,'state.json')),false);
 const f=fixture(t),{DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(f.options.file),data=JSON.parse(JSON.stringify(acceptedProfile(f).profile));db.exec('PRAGMA journal_mode=DELETE; CREATE TABLE state (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES (1,?)').run(JSON.stringify(data));db.close();const store=await lifecycle().openProfile({dataDir:f.dir});f.stores.push(store);assert.deepEqual(store.load(),data);await store.barrier(data,'mission');await store.close();const read=new DatabaseSync(f.options.file,{readOnly:true});try{assert.equal(read.prepare('PRAGMA journal_mode').get().journal_mode,'wal');assert.deepEqual(JSON.parse(read.prepare('SELECT value FROM state WHERE id=1').get().value),data);}finally{read.close();}
});

test('supervised reservation roundtrip rejects malformed authority without overwriting durable state',{timeout:15000},async t=>{
 for(const kind of ['json','sqlite']){
  const f=fixture(t,kind),book=new MissionBook(),run={version:1,id:'r',projectId:'p',missionIds:[],revision:0,phase:'unknown',grant:{id:'g',createdBy:'captain',scope:{projectId:'p',objective:'Local fixture',activities:['read']},maxWorkers:3,maxInitialAssignments:16,maxLaunches:32,maxRepairs:3,workerMs:900000,activeMs:3600000,tokenLimit:100000,improvementMs:0,improvementTokens:0},counters:{launches:1,repairs:0,activeMs:500,tokens:100,improvementMs:0,improvementTokens:0},assignments:[{id:'a',crewId:'robin',roleId:'researcher',capability:'research',objective:'Inspect local fixture',ownedPaths:[],dependencies:[],criteriaIds:[],baseCommit:'base',state:'unknown',taskId:'t',launchReservationId:'reservation'}],workspaces:[],reviews:[],readiness:null,decisions:[],improvementTriggers:[],stopIntent:null};
  book.data.runs=[run];const value={missionBook:book.data,tasks:[{id:'t',crewId:'robin',projectId:'p',runId:'r',assignmentId:'a',status:'unknown',messages:[{text:'retained'}]}],opaque:{keep:true}};
  const seed=await open(f);await seed.barrier(value,'dispatch');await seed.close();const reopened=await open(f);assert.deepEqual(reopened.load(),value);
  const malformed=structuredClone(value);malformed.missionBook.runs[0].counters.tokens=-1;await assert.rejects(reopened.barrier(malformed,'dispatch'),/invalid|unsupported/i);await assert.rejects(reopened.close());const verify=await open(f);assert.deepEqual(verify.load(),value);
 }
});
