const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {MissionBook}=require('../desktop/missions.cjs');
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
function api(){return require('../desktop/mission-result-status.cjs');}
function fixture(){
 const book=new MissionBook(),mission=book.create({projectId:'p',title:'Read result',objective:'Preserve history',acceptanceCriteria:['Exact result']});
 const attempt=book.begin(mission.id,mission.revision),task={id:attempt.taskId,projectId:'p',status:'finished',messages:[{id:'reply',role:'assistant',text:'Current result 🛠️',time:1}]};
 book.sync([task],[]);mission.selectedResult={id:'selected',attemptId:attempt.id,producerTaskId:task.id,ref:{kind:'reply',taskId:task.id,messageId:'reply',sha256:sha(task.messages[0].text)},selectedAt:1};
 const state={projects:[{id:'p'}],tasks:[task],missions:[mission]};
 return {book,mission,attempt,task,state,context:{getState:()=>state},args:{projectId:'p',missionId:mission.id,revision:mission.revision}};
}
test('result_status_is_bounded_main_verified_read_without_mutation',async()=>{
 const f=fixture(),before=structuredClone(f.state);f.task.messages[0].text='x'.repeat(1999)+'🛠'+'y'.repeat(10000);f.mission.selectedResult.ref.sha256=sha(f.task.messages[0].text);const current=structuredClone(f.state);
 const result=await api().getMissionResultStatus(f.context,f.args);
 assert.equal(result.available,true);assert.equal(result.resultId,'selected');assert.deepEqual(result.ref,f.mission.selectedResult.ref);assert.equal(result.preview,'x'.repeat(1999));assert.equal(result.text,undefined);assert.deepEqual(f.state,current);assert.equal(before.missions[0].status,f.mission.status);
});
test('result_status_rejects_foreign_stale_duplicate_and_extra_arguments',async()=>{
 const f=fixture();for(const args of [{...f.args,projectId:'other'},{...f.args,revision:f.args.revision+1},{...f.args,approved:true},{...f.args,missionId:''}])await assert.rejects(api().getMissionResultStatus(f.context,args),/project|revision|changed|argument|mission/i);
 f.state.missions.push(f.mission);await assert.rejects(api().getMissionResultStatus(f.context,f.args),/unique|mission/i);
});
test('changed_or_duplicate_reply_is_unavailable_even_with_selected_receipt',async()=>{
 const f=fixture();f.task.messages[0].text+=' changed';assert.equal((await api().getMissionResultStatus(f.context,f.args)).available,false);
 f.task.messages[0].text='Current result 🛠️';f.task.messages.push({...f.task.messages[0]});assert.equal((await api().getMissionResultStatus(f.context,f.args)).available,false);
});
test('pending_acceptance_never_reads_as_available',async()=>{
 const f=fixture();f.mission.pendingAcceptance={id:'intent'};const result=await api().getMissionResultStatus(f.context,f.args);assert.equal(result.available,false);assert.match(result.unavailable,/pending|recovery/i);
});
test('malformed_selected_ref_never_exposes_opaque_private_fields',async()=>{
 const f=fixture();f.mission.selectedResult.ref.privateRpc={synthetic:'excluded'};const result=await api().getMissionResultStatus(f.context,f.args);assert.equal(result.available,false);assert.equal(result.ref,undefined);assert.equal(JSON.stringify(result).includes('excluded'),false);
});
test('completed_result_read_does_not_reopen_or_accept_mission',async()=>{
 const f=fixture();f.book.accept(f.mission.id,f.mission.revision,[true],{resultId:f.mission.selectedResult.id,attemptId:f.attempt.id,producerTaskId:f.task.id,ref:f.mission.selectedResult.ref});f.args.revision=f.mission.revision;const before=structuredClone(f.state);
 assert.equal((await api().getMissionResultStatus(f.context,f.args)).available,true);assert.deepEqual(f.state,before);f.task.messages[0].text+=' drift';assert.equal((await api().getMissionResultStatus(f.context,f.args)).available,false);assert.equal(f.mission.status,'COMPLETE');
});
test('file_result_rechecks_replaced_live_entity_after_await',async()=>{
 const f=fixture(),artifact={id:'file',kind:'deliverable',attemptId:f.attempt.id,projectId:'p',filePath:'result.md',sha256:sha('file')};f.mission.artifacts.push(artifact);f.mission.selectedResult.ref={kind:'deliverable',artifactId:'file',sha256:artifact.sha256};
 let resolve;f.context.readArtifact=()=>new Promise(yes=>{resolve=yes;});const pending=api().getMissionResultStatus(f.context,f.args);await new Promise(yes=>setImmediate(yes));f.state.missions=[{...f.mission,revision:f.mission.revision+1}];resolve({sha256:artifact.sha256});await assert.rejects(pending,/changed|revision/i);
});
test('file_drift_and_missing_reader_do_not_return_available',async()=>{
 const f=fixture(),artifact={id:'file',kind:'deliverable',attemptId:f.attempt.id,projectId:'p',filePath:'result.md',sha256:sha('file')};f.mission.artifacts.push(artifact);f.mission.selectedResult.ref={kind:'deliverable',artifactId:'file',sha256:artifact.sha256};
 assert.equal((await api().getMissionResultStatus(f.context,f.args)).available,false);f.context.readArtifact=async()=>({sha256:sha('changed')});assert.equal((await api().getMissionResultStatus(f.context,f.args)).available,false);
});
test('page_reply_reference_hashes_full_message_not_segment_or_forged_metadata',()=>{
 const f=fixture(),page={epoch:'e',taskId:f.task.id,revision:1,segments:[{messageId:'reply',role:'assistant',offset:0,text:'Current',totalLength:f.task.messages[0].text.length,replyRef:{sha256:'forged'}}]};
 const result=api().attachCanonicalReplyRefs(f.context,{projectId:'p',taskId:f.task.id},page);assert.equal(result.segments[0].replyRef.sha256,sha(f.task.messages[0].text));assert.notEqual(result.segments[0].replyRef.sha256,sha('Current'));assert.equal(page.segments[0].replyRef.sha256,'forged');
});
test('page_reply_reference_rejects_non_members_and_duplicate_or_working_replies',()=>{
 const f=fixture(),request={projectId:'p',taskId:f.task.id},page={taskId:f.task.id,segments:[{messageId:'reply',text:'partial'}]};
 assert.throws(()=>api().attachCanonicalReplyRefs(f.context,{...request,projectId:'foreign'},page),/project|task/i);
 f.task.status='working';assert.equal(api().attachCanonicalReplyRefs(f.context,request,page).segments[0].replyRef,undefined);f.task.status='finished';f.task.messages.push({...f.task.messages[0]});assert.equal(api().attachCanonicalReplyRefs(f.context,request,page).segments[0].replyRef,undefined);
});
