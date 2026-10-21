const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {MissionBook}=require('../desktop/missions.cjs');
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
function fixture(){
 const book=new MissionBook(),mission=book.create({projectId:'p',title:'Result',objective:'Save items',acceptanceCriteria:['Items reload']});
 const attempt=book.begin(mission.id,mission.revision),task={id:attempt.taskId,projectId:'p',status:'finished',messages:[{id:'reply',role:'assistant',text:'Saved café items'}]};
 book.sync([task],[]);return {book,mission,attempt,task,ref:{kind:'reply',taskId:task.id,messageId:'reply',sha256:sha(task.messages[0].text)}};
}
function resolver(){let api;try{api=require('../desktop/mission-results.cjs');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}assert.equal(typeof api?.resolveMissionResult,'function','mission result resolver must exist');return api.resolveMissionResult;}
test('reply_reference_requires_unique_finished_attempt_message',async()=>{
 const resolve=resolver(),f=fixture();assert.deepEqual(await resolve({...f,tasks:[f.task]}),{producerTaskId:f.task.id,ref:f.ref});
 for(const messages of [[],[{role:'assistant',text:'Saved café items'}],[{id:'reply',role:'user',text:'Saved café items'}],[{id:'reply',role:'system',text:'Saved café items'}],[{id:'reply',role:'assistant',text:' '}],[...f.task.messages,...f.task.messages]])await assert.rejects(resolve({...f,tasks:[{...f.task,messages}]}),/message|reply/i);
 for(const task of [{...f.task,status:'working'},{...f.task,external:true},{...f.task,projectId:'other'},{...f.task,id:'foreign'},{...f.task,attemptId:'old-attempt'},{...f.task,missionId:'other-mission'}])await assert.rejects(resolve({...f,tasks:[task]}),/task|project|attempt|local|finished/i);
 await assert.rejects(resolve({...f,tasks:[f.task,f.task]}),/unique|task/i);
 f.attempt.taskIds=[];await assert.rejects(resolve({...f,tasks:[f.task]}),/attempt|member/i);
});
test('changed_reply_or_file_cannot_accept',async()=>{
 const resolve=resolver(),f=fixture();f.task.messages[0].text+=' changed';await assert.rejects(resolve({...f,tasks:[f.task]}),/changed|hash/i);
 const artifact={id:'file',kind:'deliverable',attemptId:f.attempt.id,projectId:'p',filePath:'result.md',sha256:sha('original')};f.mission.artifacts.push(artifact);
 const input={...f,tasks:[f.task],ref:{kind:'deliverable',artifactId:artifact.id,sha256:artifact.sha256},producerTaskId:f.task.id};
 await assert.rejects(resolve({...input,readArtifact:async()=>({sha256:sha('changed')})}),/changed|hash/i);
 assert.deepEqual(await resolve({...input,readArtifact:async value=>{assert.equal(value,artifact);return {sha256:artifact.sha256};}}),{producerTaskId:f.task.id,ref:input.ref});
});
test('deliverable_requires_current_attached_artifact_and_explicit_producer_membership',async()=>{
 const resolve=resolver(),f=fixture(),artifact={id:'file',kind:'image',attemptId:f.attempt.id,projectId:'p',sha256:sha('pixels')};f.mission.artifacts.push(artifact);
 const input={...f,tasks:[f.task],ref:{kind:'deliverable',artifactId:'file',sha256:artifact.sha256},readArtifact:async()=>({sha256:artifact.sha256})};
 await assert.rejects(resolve(input),/producer/i);await assert.rejects(resolve({...input,producerTaskId:'foreign'}),/attempt|member|task/i);
 for(const change of [{attemptId:'old'},{projectId:'other'},{kind:'check'}]){Object.assign(artifact,change);await assert.rejects(resolve({...input,producerTaskId:f.task.id}),/artifact|deliverable|attempt|project/i);Object.assign(artifact,{attemptId:f.attempt.id,projectId:'p',kind:'image'});}
 f.mission.artifacts=[];await assert.rejects(resolve({...input,producerTaskId:f.task.id}),/artifact|deliverable/i);
});
test('result_reference_rejects_unknown_fields_and_mismatched_producer',async()=>{
 const resolve=resolver(),f=fixture();for(const ref of [{...f.ref,approved:true},{...f.ref,sha256:'bad'},{...f.ref,messageId:''},null])await assert.rejects(resolve({...f,tasks:[f.task],ref}),/reference|result/i);
 await assert.rejects(resolve({...f,tasks:[f.task],producerTaskId:'other'}),/producer|task/i);
});
test('unattached_result_cannot_accept',()=>{const f=fixture();assert.throws(()=>f.book.accept(f.mission.id,f.mission.revision,[true]),/selected|result/i);assert.equal(f.mission.status,'WAITING_FOR_REVIEW');assert.equal(f.mission.acceptance,undefined);});
test('new_attempt_clears_selection',()=>{const f=fixture();f.mission.selectedResult={id:'selected',attemptId:f.attempt.id,producerTaskId:f.task.id,ref:f.ref,selectedAt:Date.now()};const next=f.book.begin(f.mission.id,f.mission.revision);assert.notEqual(next.id,f.attempt.id);assert.equal(f.mission.selectedResult,undefined);});

test('supervised acceptance fails closed without independent criterion readiness even with a selected result',()=>{const f=fixture();f.mission.runId='supervised';assert.throws(()=>f.book.accept(f.mission.id,f.mission.revision,[true],{producerTaskId:f.task.id,ref:f.ref}),/structured readiness/i);assert.equal(f.mission.status,'WAITING_FOR_REVIEW');assert.equal(f.mission.acceptance,undefined);});
