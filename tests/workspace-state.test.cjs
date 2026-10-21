const test=require('node:test');
const assert=require('node:assert/strict');
const helper=require('../desktop/workspace-state.cjs');
const {emptyWorkspace}=require('../desktop/mission-profile.cjs');
const snapshot=()=>({projects:[{id:'p'},{id:'other'}],tasks:[{id:'t',projectId:'p'}],missions:[{id:'m',projectId:'p',attempts:[{id:'a',taskIds:['t']}],selectedResult:{id:'result',attemptId:'a',ref:{sha256:'f'.repeat(64)}},acceptance:{id:'receipt',actor:'captain',attemptId:'a',resultId:'result',resultSha256:'f'.repeat(64)}}],settings:{reducedMotion:false}});
const draft=(extra={})=>({id:'d',kind:'message',projectId:'p',taskId:'t',text:'Captain input',revision:0,updatedAt:1,...extra});
const update=(current,input,state=snapshot())=>helper.applyWorkspaceUpdate(current,{expectedRevision:current.revision,...input},state);

test('pure_workspace_helper_API_is_available',()=>{
 for(const name of ['applyWorkspaceUpdate','validateWorkspaceUpdate','validateWorkspaceDraft','getWorkspaceReferenceAvailability','claimAcceptanceCue'])assert.equal(typeof helper[name],'function',name);
});

test('two_windows_cannot_overwrite_newer_draft',()=>{
 const initial=emptyWorkspace(),saved=update(initial,{draft:draft()});
 assert.equal(saved.revision,1);assert.equal(saved.drafts[0].revision,1);assert.deepEqual(initial,emptyWorkspace());
 assert.throws(()=>helper.applyWorkspaceUpdate(saved,{expectedRevision:0,draft:draft({text:'Old input'})},snapshot()),error=>error.code==='WORKSPACE_CONFLICT'&&error.latestWorkspace.drafts[0].text==='Captain input');
 assert.throws(()=>update(saved,{draft:draft({revision:0})}),/draft revision/i);
 const newer=update(saved,{draft:draft({revision:1,text:'Newer captain input'})});assert.equal(newer.drafts[0].revision,2);
});
test('older_launch_response_cannot_clear_edited_draft',()=>{
 const saved=update(emptyWorkspace(),{draft:draft()}),newer=update(saved,{draft:draft({revision:1,text:'Newer captain input'})});
 assert.throws(()=>update(newer,{deleteDraft:{id:'d',expectedDraftRevision:1}}),/draft revision/i);assert.equal(newer.drafts[0].text,'Newer captain input');
 assert.deepEqual(update(newer,{deleteDraft:{id:'d',expectedDraftRevision:2}}).drafts,[]);
});
test('deleted_reference_is_explicitly_unavailable',()=>{
 const context={projectId:'gone',missionId:'missing',attemptId:'old',taskId:'deleted',surface:'franky',returnTo:{view:'deck',projectId:'gone'}};
 const saved=update(emptyWorkspace(),{context,draft:draft({projectId:'gone',taskId:'deleted'})});
 assert.deepEqual(saved.context,context);assert.deepEqual(helper.getWorkspaceReferenceAvailability(saved.context,snapshot()),{project:false,mission:false,attempt:false,task:false});
 assert.throws(()=>update(emptyWorkspace(),{context:{...context,projectId:'other',taskId:'t'}}),/membership/i);
 assert.throws(()=>update(emptyWorkspace(),{context:{...context,projectId:'other',missionId:'m'}}),/membership/i);
 assert.throws(()=>update(emptyWorkspace(),{context:{...context,projectId:'p',missionId:'m',attemptId:'a',taskId:'outside'}}, {...snapshot(),tasks:[{id:'outside',projectId:'p'}]}),/membership/i);
 assert.throws(()=>update(emptyWorkspace(),{draft:draft({projectId:'other'})}),/membership/i);
});
test('restart_keeps_draft_without_dispatch',()=>{
 const saved=update(emptyWorkspace(),{draft:draft()});const restored=JSON.parse(JSON.stringify(saved));
 assert.deepEqual(restored,saved);const next=update(restored,{context:null});assert.deepEqual(next.drafts,saved.drafts);
 next.drafts[0].text='Changed copy';assert.equal(restored.drafts[0].text,'Captain input');
});
test('presentation_updates_reject_extra_fields_and_invalid_shapes',()=>{
 for(const input of [{provider:'codex'},{model:'x'},{tools:[]},{deleteDraft:{id:'d',expectedDraftRevision:0,force:true}},{expectedRevision:-1},{seenAcceptanceId:'unknown'},{draft:draft({provider:'x'})},{context:{projectId:'p',surface:'deck',returnTo:{view:'deck'},proof:true}}])assert.throws(()=>update(emptyWorkspace(),input));
 assert.throws(()=>update(emptyWorkspace(),{draft:draft(),deleteDraft:{id:'d',expectedDraftRevision:0}}),/both/i);
 assert.throws(()=>update(emptyWorkspace(),{deleteDraft:{id:'absent',expectedDraftRevision:0}}),/draft revision/i);
});
test('limits_keep_input_without_dispatch',()=>{
 const initial=emptyWorkspace();
 for(const changed of [{text:'x'.repeat(50001)},{title:'x'.repeat(201)},{criteria:Array(21).fill('x')},{criteria:['x'.repeat(2001)]}]){const input=draft(changed);assert.throws(()=>update(initial,{draft:input}));assert.deepEqual(initial,emptyWorkspace());assert.deepEqual(input,draft(changed));}
 const atLimit=draft({text:'x'.repeat(50000),title:'x'.repeat(200),criteria:Array(20).fill('x'.repeat(2000))});assert.equal(update(initial,{draft:atLimit}).drafts[0].text.length,50000);
 let current=initial;for(let n=0;n<50;n++)current=update(current,{draft:draft({id:'d'+n})});assert.throws(()=>update(current,{draft:draft({id:'d50'})}));assert.equal(current.drafts.length,50);
 let large=initial;for(let n=0;n<6;n++)large=update(large,{draft:draft({id:'big'+n,text:'界'.repeat(50000)})});assert.throws(()=>update(large,{draft:draft({id:'overflow',text:'界'.repeat(50000)})}),/MiB/i);assert.equal(large.drafts.length,6);
});
test('receipt_claim_is_atomic_across_surfaces',()=>{
 const first=helper.claimAcceptanceCue(emptyWorkspace(),{acceptanceId:'receipt'},snapshot());assert.equal(first.play,true);
 const second=helper.claimAcceptanceCue(first.workspace,{acceptanceId:'receipt'},snapshot());assert.equal(second.play,false);assert.deepEqual(second.workspace,first.workspace);
 for(const state of [{...snapshot(),missions:[]},{...snapshot(),missions:[{acceptance:{id:'receipt',legacy:true}}]},{...snapshot(),settings:{reducedMotion:true}}])assert.equal(helper.claimAcceptanceCue(emptyWorkspace(),{acceptanceId:'receipt'},state).play,false);
 assert.throws(()=>helper.claimAcceptanceCue(emptyWorkspace(),{acceptanceId:'receipt',proof:true},snapshot()));
 const current={...emptyWorkspace(),seenAcceptanceIds:Array.from({length:500},(_,n)=>'old'+n)};const retained=helper.claimAcceptanceCue(current,{acceptanceId:'receipt'},snapshot());assert.equal(retained.play,false);assert.deepEqual(retained.workspace,current);
});
test('standalone_draft_validation_reuses_saved_workspace_bounds',()=>{
 assert.doesNotThrow(()=>helper.validateWorkspaceDraft(draft()));assert.throws(()=>helper.validateWorkspaceDraft(draft({text:'x'.repeat(50001)})));
 assert.doesNotThrow(()=>helper.validateWorkspaceUpdate({expectedRevision:0,context:null}));assert.throws(()=>helper.validateWorkspaceUpdate({expectedRevision:0,provider:'x'}));
});
test('malformed_current_workspace_fails_closed_before_any_update',()=>{
 for(const current of [{...emptyWorkspace(),version:2},{...emptyWorkspace(),revision:-1},{...emptyWorkspace(),drafts:[draft({unexpected:true})]},{...emptyWorkspace(),seenAcceptanceIds:['duplicate','duplicate']}]){
  const before=structuredClone(current);assert.throws(()=>helper.applyWorkspaceUpdate(current,{expectedRevision:0,context:null},snapshot()));assert.deepEqual(current,before);
 }
 const exhausted={...emptyWorkspace(),revision:Number.MAX_SAFE_INTEGER};assert.throws(()=>helper.applyWorkspaceUpdate(exhausted,{expectedRevision:exhausted.revision,context:null},snapshot()));assert.equal(exhausted.revision,Number.MAX_SAFE_INTEGER);
});
test('receipt_claim_rejects_duplicate_or_unbound_modern_receipts',()=>{
 const original=snapshot();
 for(const missions of [[original.missions[0],structuredClone(original.missions[0])],[{...original.missions[0],selectedResult:undefined}],[{...original.missions[0],acceptance:{...original.missions[0].acceptance,resultId:'wrong'}}]]){
  assert.equal(helper.claimAcceptanceCue(emptyWorkspace(),{acceptanceId:'receipt'},{...original,missions}).play,false);
 }
 const first=update(emptyWorkspace(),{seenAcceptanceId:'receipt'});assert.deepEqual(first.seenAcceptanceIds,['receipt']);
 const second=update(first,{seenAcceptanceId:'receipt'});assert.deepEqual(second.seenAcceptanceIds,['receipt']);
});
test('return_destination_membership_is_validated_without_replacing_missing_ids',()=>{
 const base={projectId:'p',surface:'deck',returnTo:{view:'franky',projectId:'other',taskId:'t'}};
 assert.throws(()=>update(emptyWorkspace(),{context:base}),/membership/i);
 const missing={...base,returnTo:{view:'franky',projectId:'absent',taskId:'absent-task'}};
 assert.deepEqual(update(emptyWorkspace(),{context:missing}).context,missing);
});
