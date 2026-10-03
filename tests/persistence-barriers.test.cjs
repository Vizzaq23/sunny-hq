const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {Hub}=require('../desktop/hub.cjs');
const {MissionBook}=require('../desktop/missions.cjs');
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value),'utf8').digest('hex');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function reviewProfile(){
 const book=new MissionBook(),mission=book.create({projectId:'p',title:'Synthetic receipt test',objective:'Retain exact content',acceptanceCriteria:['Reviewed exact reply'],completionBoundary:'review'}),attempt=book.begin(mission.id,mission.revision);
 const task={id:attempt.taskId,projectId:'p',crewId:'franky',status:'finished',threadId:'fixture-thread',turnId:'fixture-turn',messages:[{id:'reply',role:'assistant',text:'Exact synthetic result'}]};book.sync([task],[]);
 mission.selectedResult={id:'selection',attemptId:attempt.id,producerTaskId:task.id,ref:{kind:'reply',taskId:task.id,messageId:'reply',sha256:sha(task.messages[0].text)},selectedAt:1};
 return {missionBook:book.data,tasks:[task],opaque:{retained:'雪 🏴‍☠️'}};
}
function fixture(t,initial={}){
 let stored=structuredClone(initial),sequence=0,delay=true,expectedUncertainClose=false;const submissions=[],dispatch=[];
 function submit(image,reason){
  const captured=structuredClone(image);let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});promise.catch(()=>{});
  let settled=false;const entry={image:captured,reason,promise,commit(){if(settled)return;settled=true;stored=structuredClone(captured);resolve({epoch:'fixture-epoch',sequence:++sequence,stateSha256:sha(captured),durableAt:Date.now()});},fail(error=Error('Synthetic disk unavailable')){if(settled)return;settled=true;reject(error);}};submissions.push(entry);if(!delay)entry.commit();return promise;
 }
 const store={load:()=>structuredClone(stored),save:image=>submit(image,'legacy'),barrier:submit,checkpoint:image=>submit(image,null),flush:async()=>null,close:async()=>{}};
 const hub=new Hub({home:process.cwd(),store,catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});hub.client.connected=true;hub.state.codex.status='connected';hub.ensure=async()=>{};
 hub.client.request=async method=>{dispatch.push(method);return method==='thread/start'?{thread:{id:'fixture-new-thread'}}:method==='turn/start'?{turn:{id:'fixture-new-turn'}}:{};};
 t.after(async()=>{delay=false;for(const entry of submissions)entry.commit();await tick();try{await hub.close();}catch(error){if(!expectedUncertainClose||error.code!=='COMMIT_UNCERTAIN')throw error;}});
 return {hub,submissions,dispatch,get stored(){return stored;},immediate(){delay=false;},delayed(){delay=true;},expectUncertainClose(){expectedUncertainClose=true;},async settle(){for(let i=0;i<24;i++){for(const entry of submissions)entry.commit();await tick();}}};
}
function acceptance(hub){const mission=hub.state.missions[0];return {missionId:mission.id,revision:mission.revision,resultId:mission.selectedResult.id,resultSha256:mission.selectedResult.ref.sha256,criteria:[true]};}

test('no_dispatch_or_acceptance_before_durable_receipt: dispatch',async t=>{
 const f=fixture(t),pending=f.hub.start({projectId:'p',crewId:'franky',prompt:'Synthetic transport only'});pending.catch(()=>{});await tick();
 assert.ok(f.submissions.length,'dispatch must submit an intent');assert.deepEqual(f.dispatch,[],'provider dispatch must wait for a durable receipt');await f.settle();await pending;
});
test('no_dispatch_or_acceptance_before_durable_receipt: acceptance',async t=>{
 const f=fixture(t,reviewProfile()),pending=f.hub.acceptMission(acceptance(f.hub));pending.catch(()=>{});await tick();
 assert.equal(f.hub.state.missions[0].status,'WAITING_FOR_REVIEW');assert.equal(f.hub.state.missions[0].acceptance,undefined);assert.equal(f.submissions[0].image.missionBook.missions[0].status,'WAITING_FOR_REVIEW');assert.ok(f.submissions[0].image.missionBook.missions[0].pendingAcceptance,'first save must retain a restart fence');await f.settle();await pending;
});
test('newer_stream_and_reentrant_edits_survive_barrier_failure',async t=>{
 const f=fixture(t,reviewProfile()),task=f.hub.state.tasks[0];const pending=Promise.resolve(f.hub.updateWorkspace({expectedRevision:0,draft:{id:'fixture-draft',kind:'brief',projectId:'p',title:'Draft',text:'Retain draft',criteria:['Retained'],completionBoundary:'review',revision:0,updatedAt:1}}));pending.catch(()=>{});await tick();
 task.messages[0].text+=' New stream';f.hub.streamChanged(task);f.hub.state.news.opaqueFixture='newer news';f.hub.on('event',event=>{if(event.type==='persistence')f.hub.state.settings.opaqueFixture='reentrant setting';});f.submissions[0].fail();
 await assert.rejects(pending,/disk unavailable/);assert.match(task.messages[0].text,/New stream/);assert.equal(f.hub.state.news.opaqueFixture,'newer news');assert.equal(f.hub.state.settings.opaqueFixture,'reentrant setting');assert.equal(f.hub.state.workspace.revision,0);f.immediate();
});
test('changed_result_during_pending_acceptance_withholds_cue',async t=>{
 const f=fixture(t,reviewProfile()),pending=f.hub.acceptMission(acceptance(f.hub));pending.catch(()=>{});await tick();f.hub.state.tasks[0].messages[0].text+=' Changed after submission';f.hub.streamChanged(f.hub.state.tasks[0]);await f.settle();
 await assert.rejects(pending,/changed/i);const mission=f.hub.state.missions[0];assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.equal(mission.acceptance,undefined);assert.equal(f.stored.missionBook.missions[0].status,'WAITING_FOR_REVIEW');assert.deepEqual(await f.hub.claimAcceptanceCue({acceptanceId:'selection'}),{play:false});
});
test('authority_sync_after_barrier_is_not_discarded',async t=>{
 const profile=reviewProfile();delete profile.missionBook.missions[0].selectedResult;profile.missionBook.missions[0].attempts[0].status='working';profile.missionBook.missions[0].status='RUNNING';profile.tasks[0].status='working';const f=fixture(t,profile);
 const pending=Promise.resolve(f.hub.persist('mission'));pending.catch(()=>{});await tick();f.hub.state.tasks[0].status='finished';f.hub.changed();f.submissions[0].commit();await pending;await tick();
 assert.notEqual(f.hub.state.persistence.state,'saved','an older receipt cannot acknowledge newer mission sync');f.immediate();await f.settle();await f.hub.persist('mission');assert.equal(f.stored.missionBook.missions[0].status,'WAITING_FOR_REVIEW');
});
test('queue_saturation_rejects_before_mutation',async()=>{
 let AuthorityCommitQueue;try{({AuthorityCommitQueue}=require('../desktop/persistence-barriers.cjs'));}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
 assert.equal(typeof AuthorityCommitQueue,'function','bounded authority intent queue must exist');let release,sequence=0;const held=new Promise(resolve=>release=resolve),store={barrier:async image=>{await held;return {epoch:'fixture',sequence:++sequence,stateSha256:sha(image),durableAt:1};}},queue=new AuthorityCommitQueue({store});let prepared=0;
 const prepare=()=>{prepared++;return {image:{fixture:true},validate:()=>{},publish:()=>prepared};};const pending=[queue.run('mission',prepare)];await tick();for(let i=0;i<16;i++)pending.push(queue.run('mission',prepare));
 await assert.rejects(queue.run('mission',prepare),/busy|saturat|pending/i);assert.equal(prepared,1,'waiting intents must not capture or mutate state');release();await Promise.all(pending);
});
test('final_receipt_invalidation_compensates_exact_entity_and_retains_newer_data',async t=>{
 const f=fixture(t,reviewProfile()),pending=f.hub.acceptMission(acceptance(f.hub));pending.catch(()=>{});await tick();f.submissions[0].commit();await tick();
 const final=f.submissions.find(entry=>entry.image.missionBook.missions[0].status==='COMPLETE');assert.ok(final);f.hub.state.tasks[0].messages[0].text+=' Later reply';f.hub.streamChanged(f.hub.state.tasks[0]);f.hub.state.settings.retainedNewer={unicode:'雪'};final.commit();await f.settle();await assert.rejects(pending,/changed/i);
 const live=f.hub.state.missions[0],saved=f.stored.missionBook.missions[0];assert.equal(live.status,'WAITING_FOR_REVIEW');assert.equal(live.acceptance,undefined);assert.equal(saved.status,'WAITING_FOR_REVIEW');assert.deepEqual(live.events,saved.events,'acknowledged audit must match the exact corrective image');assert.deepEqual(f.hub.state.settings.retainedNewer,{unicode:'雪'});assert.match(f.hub.state.tasks[0].messages[0].text,/Later reply/);assert.deepEqual(f.stored.opaque,{retained:'雪 🏴‍☠️'});
});
test('pending_acceptance_is_explicitly_validated_in_current_profile_format',()=>{
 const profile=reviewProfile(),mission=profile.missionBook.missions[0];mission.pendingAcceptance={id:'bad',resultId:'selection'};assert.throws(()=>new MissionBook(profile.missionBook),/pending|acceptance|intent/i);
});
test('uncertain_branch_switch_keeps_reservation_until_saved_inspection',async t=>{
 const f=fixture(t);f.immediate();const mission=await f.hub.createMission({projectId:'p',title:'Branch fixture',objective:'Inspect unknown switch',acceptanceCriteria:['Bounded recovery']});let creates=0;
 f.hub.branches={plan:async()=>({name:'codex/sunny-fixture',state:'preparing'}),create:async()=>{creates++;throw Object.assign(Error('Switch outcome uncertain'),{uncertain:true});},inspect:async()=>({ready:true})};
 await assert.rejects(f.hub.prepareMissionBranch({missionId:mission.id,revision:mission.revision}),/uncertain/);assert.equal(f.hub.gate.blocked(process.cwd()),true);await f.hub.prepareMissionBranch({missionId:mission.id,revision:mission.revision});assert.equal(creates,1);assert.equal(f.hub.gate.blocked(process.cwd()),false);assert.equal(mission.branch.state,'ready');
});
test('Hub_keeps_opaque_nested_service_fields_in_submitted_profile',async t=>{
 const profile=reviewProfile();profile.world={opaqueWorld:{future:['雪']}};profile.news={opaqueNews:{future:42}};profile.growth={opaqueGrowth:true,profiles:{franky:{opaqueProfile:{future:'retained'}},futureCrew:{opaqueFuture:'kept'}}};profile.missionBook.opaqueBook={retained:true};profile.missionBook.missions[0].opaqueMission={retained:true};const f=fixture(t,profile);f.immediate();await f.hub.persist();
 assert.deepEqual(f.stored.world.opaqueWorld,profile.world.opaqueWorld);assert.deepEqual(f.stored.news.opaqueNews,profile.news.opaqueNews);assert.equal(f.stored.growth.opaqueGrowth,true);assert.deepEqual(f.stored.growth.profiles.franky.opaqueProfile,profile.growth.profiles.franky.opaqueProfile);assert.deepEqual(f.stored.growth.profiles.futureCrew,profile.growth.profiles.futureCrew);assert.deepEqual(f.stored.missionBook.opaqueBook,profile.missionBook.opaqueBook);assert.deepEqual(f.stored.missionBook.missions[0].opaqueMission,profile.missionBook.missions[0].opaqueMission);
});
test('receipt_validation_does_not_reserialize_full_profile_in_main',()=>{
 const {receiptMatches}=require('../desktop/persistence-barriers.cjs'),image={toJSON(){throw Error('Main profile serialization is forbidden');}},receipt={epoch:'private-worker-epoch',sequence:1,stateSha256:'a'.repeat(64),durableAt:1};assert.equal(receiptMatches(receipt,image),true);
});
test('news_preference_updates_preserve_nested_opaque_values',async t=>{
 const profile=reviewProfile();profile.news={preferences:{roles:'old',location:'old',topics:'old',opaquePreference:{future:['retained']}}};const f=fixture(t,profile);f.immediate();f.hub.news.preferences({roles:'new',location:'new',topics:'new'});await f.hub.persist();assert.deepEqual(f.stored.news.preferences.opaquePreference,profile.news.preferences.opaquePreference);assert.equal(f.stored.news.preferences.roles,'new');
});
test('approval_response_saves_exact_bound_decision_before_provider_response',async t=>{
 const f=fixture(t,{tasks:[{id:'approval-task',projectId:'p',crewId:'franky',threadId:'approval-thread',turnId:'approval-turn',status:'idle',messages:[]}]}),task=f.hub.state.tasks[0],responses=[];task.status='working';f.hub.client.respond=(rpcId,result)=>responses.push({rpcId,result});
 f.hub.request({id:'approval-rpc',method:'item/commandExecution/requestApproval',params:{threadId:task.threadId,turnId:task.turnId,command:'synthetic'}});const command={id:f.hub.state.approvals[0].id,decision:'accept'},pending=f.hub.respond(command);pending.catch(()=>{});await tick();assert.deepEqual(responses,[]);const image=f.submissions[0].image,record=image.tasks[0].approvalResponseIntent;assert.ok(record,'submitted profile must bind the captain decision');assert.equal(record.decision,'accept');assert.equal(record.executionId,task.executionId);command.decision='decline';await f.settle();await pending;assert.equal(responses[0].result.decision,'accept');
});
test('Stop_during_initial_dispatch_save_prevents_any_provider_submission',async t=>{
 const f=fixture(t),starting=f.hub.start({projectId:'p',crewId:'franky',prompt:'Synthetic only'});starting.catch(()=>{});await tick();const task=f.hub.state.tasks[0],stopping=f.hub.interrupt(task.id);stopping.catch(()=>{});await tick();await f.settle();const results=await Promise.allSettled([starting,stopping]);assert.equal(results[1].status,'fulfilled');assert.deepEqual(f.dispatch,[]);assert.equal(task.status,'interrupted');assert.equal(f.hub.gate.active.has(task.id),false);
});
test('saturated_send_does_not_append_unsent_captain_text',async t=>{
 const f=fixture(t,{tasks:[{id:'draft-task',projectId:'p',crewId:'franky',threadId:'draft-thread',status:'finished',messages:[]}]}),task=f.hub.state.tasks[0];f.hub.loaded.add(task.id);const held=[f.hub.persist()];await tick();for(let i=0;i<16;i++){const pending=f.hub.persist();pending.catch(()=>{});held.push(pending);}const sending=f.hub.send(task.id,'Preserve this unsent draft');sending.catch(()=>{});await assert.rejects(sending,/busy|pending saves/i);assert.deepEqual(task.messages,[]);assert.deepEqual(f.dispatch,[]);f.immediate();await f.settle();await Promise.all(held);
});
test('failed_acceptance_compensation_is_unresolved_and_cannot_release_or_play',async t=>{
 const f=fixture(t,reviewProfile()),pending=f.hub.acceptMission(acceptance(f.hub));pending.catch(()=>{});await tick();f.submissions[0].commit();await tick();const final=f.submissions.find(e=>e.image.missionBook.missions[0].status==='COMPLETE');assert.ok(final);f.hub.state.tasks[0].messages[0].text+=' Invalidated';f.hub.streamChanged(f.hub.state.tasks[0]);final.commit();await tick();const correction=f.submissions.at(-1);assert.equal(correction.image.missionBook.missions[0].status,'WAITING_FOR_REVIEW');correction.fail();await assert.rejects(pending,/correction is unresolved/i);assert.ok(f.hub.state.missions[0].pendingAcceptance);assert.equal(f.hub.state.missions[0].acceptance,undefined);assert.equal(f.hub.gate.blocked(process.cwd()),true);assert.equal(f.hub.state.persistence.uncertain,true);await assert.rejects(f.hub.claimAcceptanceCue({acceptanceId:'selection'}),/unresolved/i);f.expectUncertainClose();
});
test('check_outcome_save_failure_retains_check_reservation_without_replay',async t=>{
 const f=fixture(t,reviewProfile());f.immediate();const mission=f.hub.state.missions[0];let checks=0;f.hub.evidence.runCheck=async()=>{checks++;f.delayed();return {kind:'check',script:'test',status:'passed',fingerprint:'synthetic'};};const pending=f.hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,script:'test'});pending.catch(()=>{});await tick();const outcome=f.submissions.find(e=>e.image.missionBook.missions[0].artifacts.some(a=>a.kind==='check'));assert.ok(outcome);outcome.fail();await f.settle();await assert.rejects(pending,/disk unavailable/);assert.equal(checks,1);assert.ok(mission.checkExecution);assert.equal(mission.artifacts.filter(a=>a.kind==='check').length,0);assert.equal(f.hub.gate.blocked(process.cwd()),true);assert.ok(f.stored.missionBook.missions[0].checkExecution);
});
test('publication_outcome_save_failure_stays_reserved_until_explicit_reconciliation',async t=>{
 const f=fixture(t,reviewProfile());f.immediate();const mission=f.hub.state.missions[0];mission.prPublication={id:'publication',attemptId:mission.activeAttemptId,state:'prepared',expiresAt:Date.now()+10000};let published=0;f.hub.publisher={validate:async()=>{},publish:async()=>{published++;f.delayed();return {number:1,url:'https://github.com/fixture/sunny/pull/1'};}};
 const pending=f.hub.publication.act({missionId:mission.id,revision:mission.revision,previewId:'publication',confirmed:true},'publish');pending.catch(()=>{});await tick();const outcome=f.submissions.find(e=>e.image.missionBook.missions[0].prPublication?.state==='published');assert.ok(outcome);outcome.fail();await f.settle();await assert.rejects(pending,/may have reached/);assert.equal(published,1);assert.equal(mission.prPublication.state,'uncertain');assert.equal(f.hub.gate.blocked(process.cwd()),true);await assert.rejects(f.hub.publication.act({missionId:mission.id,revision:mission.revision,base:'main'},'prepare'),/Reconcile/);assert.equal(published,1);
});
test('simultaneous_cross_surface_cue_claims_have_one_durable_owner',async t=>{
 const f=fixture(t,reviewProfile());f.immediate();await f.hub.acceptMission(acceptance(f.hub));const acceptanceId=f.hub.state.missions[0].acceptance.id;f.delayed();const first=f.hub.claimAcceptanceCue({acceptanceId}),second=f.hub.claimAcceptanceCue({acceptanceId});await tick();await f.settle();assert.deepEqual(await Promise.all([first,second]),[{play:true},{play:false}]);assert.deepEqual(f.stored.missionBook.workspace.seenAcceptanceIds,[acceptanceId]);
});
test('changed_deliverable_after_final_submission_is_durably_compensated',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-acceptance-file-')),file=path.join(dir,'result.md');fs.writeFileSync(file,'Exact file');const profile=reviewProfile(),mission=profile.missionBook.missions[0];profile.projects=[{id:'p',path:dir}];mission.artifacts.push({id:'deliverable',kind:'deliverable',attemptId:mission.activeAttemptId,projectId:'p',filePath:'result.md',sha256:sha('Exact file')});mission.selectedResult.ref={kind:'deliverable',artifactId:'deliverable',sha256:sha('Exact file')};const f=fixture(t,profile);t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const pending=f.hub.acceptMission(acceptance(f.hub));pending.catch(()=>{});await tick();f.submissions[0].commit();await tick();const final=f.submissions.find(e=>e.image.missionBook.missions[0].status==='COMPLETE');assert.ok(final);fs.writeFileSync(file,'Externally changed file');final.commit();await f.settle();await assert.rejects(pending,/deliverable changed/i);assert.equal(f.hub.state.missions[0].acceptance,undefined);assert.equal(f.stored.missionBook.missions[0].status,'WAITING_FOR_REVIEW');assert.equal(fs.readFileSync(file,'utf8'),'Externally changed file');
});
test('Hub_acceptance_roundtrips_through_worker_owned_JSON_without_external_calls',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{openOrderedStore}=require('../desktop/ordered-store.cjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-acceptance-store-')),file=path.join(dir,'state.json'),profile=reviewProfile();profile.projects=[{id:'p',path:dir}];fs.writeFileSync(file,JSON.stringify(profile));const store=await openOrderedStore({kind:'json',file,backupDir:path.join(dir,'backups')}),hub=new Hub({home:dir,store,catalog:{discoverProjects:()=>profile.projects,discoverTools:()=>[],discoverAutomations:()=>[]}});let calls=0;hub.client.request=async()=>{calls++;throw Error('No external calls authorized in fixture');};t.after(async()=>{await hub.close();fs.rmSync(dir,{recursive:true,force:true});});
 await hub.acceptMission(acceptance(hub));const disk=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(disk.missionBook.missions[0].status,'COMPLETE');assert.equal(disk.missionBook.missions[0].acceptance.id,hub.state.missions[0].acceptance.id);assert.equal(disk.missionBook.missions[0].pendingAcceptance,undefined);assert.deepEqual(disk.opaque,profile.opaque);assert.equal(hub.lastReceipt.stateSha256,sha(disk));assert.equal(calls,0);assert.equal(require('../desktop/mission-profile.cjs').inspectMissionProfile(disk).mode,'v3');
});
test('island_Stop_acknowledges_saved_job_and_task_outcomes_together',async t=>{
 const f=fixture(t);f.immediate();const job=f.hub.island.saveJob({name:'Synthetic job',crewId:'franky',projectId:'p',district:'engineering',objective:'Fixture only',intervalMinutes:15,maxRunsPerDay:1,maxTotalRuns:1,maxRunMinutes:1,dailyTokenLimit:1000,requiresReview:true});await f.hub.island.run(job.id);f.delayed();const stopped=f.hub.island.stop(job.id);stopped.catch(()=>{});await tick();await f.settle();await stopped;const savedJob=f.stored.world.jobs.find(j=>j.id===job.id);assert.equal(savedJob.status,'blocked');assert.equal(savedJob.runs.at(-1).status,'stopped');assert.equal(f.stored.tasks[0].status,'interrupted');
});
test('direct_tool_dispatch_saves_exact_arguments_before_provider_call',async t=>{
 const f=fixture(t,{tasks:[{id:'tool-task',projectId:'p',crewId:'franky',threadId:'tool-thread',status:'idle',messages:[]}]}),calls=[],args={target:{value:'reviewed'}};f.hub.client.request=async(method,params)=>{calls.push({method,params:structuredClone(params)});return {ok:true};};const pending=f.hub.callTool({taskId:'tool-task',server:'fixture',name:'synthetic',arguments:args});pending.catch(()=>{});await tick();args.target.value='changed during save';assert.deepEqual(calls,[]);assert.deepEqual(f.submissions[0].image.tasks[0].toolDispatchIntent.arguments,{target:{value:'reviewed'}});await f.settle();await pending;assert.deepEqual(calls[0].params.arguments,{target:{value:'reviewed'}});assert.equal(f.stored.tasks[0].toolDispatchIntent,undefined);
});
test('saturated_direct_tool_admission_preserves_task_and_zero_dispatch',async t=>{
 const f=fixture(t,{tasks:[{id:'tool-task',projectId:'p',crewId:'franky',threadId:'tool-thread',status:'idle',messages:[]}]}),pending=[f.hub.persist()];await tick();for(let i=0;i<16;i++)pending.push(f.hub.persist());await assert.rejects(f.hub.callTool({taskId:'tool-task',server:'fixture',name:'synthetic',arguments:{}}),error=>error.code==='AUTHORITY_SATURATED');assert.equal(f.hub.state.tasks[0].toolDispatchIntent,undefined);assert.deepEqual(f.dispatch,[]);await f.settle();await Promise.all(pending);
});
test('failed_tool_outcome_write_retains_reservation_and_never_replays',async t=>{
 const f=fixture(t,{tasks:[{id:'tool-task',projectId:'p',crewId:'franky',threadId:'tool-thread',status:'idle',messages:[]}]}),task=f.hub.state.tasks[0];f.immediate();let calls=0;f.hub.client.request=async()=>{calls++;f.delayed();return {ok:true};};const pending=f.hub.callTool({taskId:task.id,server:'fixture',name:'synthetic',arguments:{}});pending.catch(()=>{});await tick();f.submissions.at(-1).fail();await assert.rejects(pending,/disk unavailable/);assert.equal(task.status,'unknown');assert.equal(f.hub.gate.blocked(process.cwd()),true);assert.ok(task.toolDispatchIntent);await assert.rejects(f.hub.callTool({taskId:task.id,server:'fixture',name:'synthetic',arguments:{}}),/Reconcile/);assert.equal(calls,1);f.immediate();
});
