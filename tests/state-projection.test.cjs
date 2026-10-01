const {test}=require('node:test');
const assert=require('node:assert/strict');
let createStateProjection;
try { ({createStateProjection}=require('../desktop/state-projection.cjs')); } catch(error) { if(error.code!=='MODULE_NOT_FOUND')throw error; }
const message=(id,text)=>({id,role:'assistant',time:1,text});
const task=(id='t')=>({id,projectId:'p',crewId:'robin',title:'Read',status:'working',createdAt:1,updatedAt:2,messages:[message('m','hello')]});
const producer=()=>{assert.equal(typeof createStateProjection,'function','public state producer must exist');return createStateProjection({epoch:'session'});};

test('summary_has_no_transcript_or_private_rpc_fields',()=>{
 const p=producer(),t=task();t.secret='retained';t.executionId='private';t.rpc={token:'private'};
 t.selectedSkills=[{id:'s',revision:'r',name:'Read',path:'read.md',category:'research',purpose:'Read',roles:['robin'],secret:'private'}];
 t.tokenUsage={total:{totalTokens:10,inputTokens:2,outputTokens:8,cachedInputTokens:0,reasoningOutputTokens:0,secret:'private'},private:'no'};
 const summary=p.summary(t);
 assert.equal(summary.messageCount,1);assert.equal(summary.transcriptRevision,1);
 assert.equal(summary.id,'t');assert.equal(summary.title,'Read');
 for(const key of ['messages','secret','executionId','rpc'])assert.equal(key in summary,false);
 assert.equal('secret' in summary.selectedSkills[0],false);assert.equal('secret' in summary.tokenUsage.total,false);
 assert.equal(t.messages[0].text,'hello');assert.equal(t.secret,'retained');
 summary.selectedSkills[0].roles.push('nami');assert.deepEqual(t.selectedSkills[0].roles,['robin']);
});

test('private_snapshot_queries_do_not_create_published_sequence_gaps',()=>{
 const p=producer(),t=task(),state={tasks:[t],projects:[{id:'p',name:'Project',path:'fixture'}],settings:{reducedMotion:false},privateProfile:'retained'};
 assert.equal(p.snapshot(state).sequence,0);assert.equal(p.snapshot(state).sequence,0);
 const first=p.event('task',t);assert.equal(first.sequence,1);assert.equal(first.data.messages,undefined);
 assert.equal(p.snapshot(state).sequence,1);
 const second=p.event('snapshot',state);assert.equal(second.sequence,2);assert.equal(second.data.sequence,2);
 assert.equal(second.data.protocolVersion,2);assert.equal(second.data.tasks,undefined);assert.equal(second.data.privateProfile,undefined);
 assert.equal(second.data.taskSummaries[0].messageCount,1);
 const third=p.event('persistence',{state:'saved',failures:0});assert.equal(third.sequence,3);assert.equal(third.epoch,'session');
});

test('replacement_increments_revision_without_changing_persisted_task_schema',()=>{
 const p=producer(),t=task();p.summary(t);t.messages[0].text='replaced';
 const delta=p.transcriptChanged(t,{kind:'invalidate'});
 assert.equal(delta.kind,'invalidate');assert.equal(delta.baseRevision,1);assert.equal(delta.revision,2);assert.equal(delta.sequence,1);
 assert.equal(p.summary(t).transcriptRevision,2);assert.equal('transcriptRevision' in t,false);
 t.messages=[message('replacement','different')];assert.equal(p.transcriptChanged(t,{kind:'invalidate'}).revision,3);
});

test('bounded_append_delta_preserves_older_history_with_exact_offsets',()=>{
 const p=producer(),t=task();p.summary(t);
 t.messages.push(message('m2','new'));let d=p.transcriptChanged(t,{kind:'appendMessage',messageId:'m2'});
 assert.deepEqual({kind:d.kind,base:d.baseRevision,rev:d.revision,text:d.text,offset:d.offset,role:d.role},{kind:'appendMessage',base:1,rev:2,text:'new',offset:0,role:'assistant'});
 t.messages[1].text+='😀';d=p.transcriptChanged(t,{kind:'appendText',messageId:'m2',offset:3,text:'😀'});
 assert.equal(d.kind,'appendText');assert.equal(d.offset,3);assert.equal(d.baseRevision,2);assert.equal(d.revision,3);
 assert.equal(d.sequence,2);assert.equal(t.messages[0].text,'hello');
});

test('unverified_offsets_replacements_and_oversize_appends_invalidate',()=>{
 const p=producer(),t=task();p.summary(t);t.messages[0].text+='x';
 assert.equal(p.transcriptChanged(t,{kind:'appendText',messageId:'m',offset:0,text:'x'}).kind,'invalidate');
 t.messages.push(message('huge','界'.repeat(100000)));
 assert.equal(p.transcriptChanged(t,{kind:'appendMessage',messageId:'huge'}).kind,'invalidate');
 t.messages[0].text='edited';assert.equal(p.transcriptChanged(t,{kind:'appendText',messageId:'m',offset:6,text:'edited'}).kind,'invalidate');
});

test('surrogate_join_at_append_boundary_invalidates_and_unknown_task_seeds_conservatively',()=>{
 const p=producer(),t=task();t.messages[0].text='\ud83d';p.summary(t);t.messages[0].text+='\ude00';
 assert.equal(p.transcriptChanged(t,{kind:'appendText',messageId:'m',offset:1,text:'\ude00'}).kind,'invalidate');
 const unknown=task('new');unknown.messages.push(message('m2','new'));
 assert.equal(p.transcriptChanged(unknown,{kind:'appendMessage',messageId:'m2'}).kind,'invalidate');
});

for(const count of [100,1000,3000])test(`summary_hotpath_never_reads_or_serializes_message_text_for_${count}_tasks`,()=>{
 const p=producer(),tasks=Array.from({length:count},(_,i)=>{const t=task('t'+i);t.messages[0].text='x'.repeat(2000)+'private transcript tail';return t;});
 for(const t of tasks){p.summary(t);Object.defineProperty(t.messages[0],'text',{get(){throw Error('full transcript read on summary hot path');}});}
 const snapshot=p.snapshot({tasks});assert.equal(snapshot.taskSummaries.length,count);
 const serialized=JSON.stringify(snapshot);assert.ok(serialized.length<count*2400);assert.equal(serialized.includes('private transcript tail'),false);
});

test('cached_previews_are_bounded_surrogate_safe_and_not_result_authority',()=>{
 const p=producer(),t=task();t.messages[0].text='x'.repeat(1999)+'😀tail';t.messages.push({...message('activity','Read files'),role:'system'});
 const s=p.summary(t);assert.equal(s.lastAssistantPreview,'x'.repeat(1999));assert.equal(s.latestActivity,'Read files');
 assert.equal(s.resultSha256,undefined);assert.equal(s.selectedResult,undefined);
 t.messages.push(message('latest','new reply'));p.transcriptChanged(t,{kind:'appendMessage',messageId:'latest'});
 assert.equal(p.summary(t).lastAssistantPreview,'new reply');
});

test('append_to_older_message_keeps_latest_assistant_preview',()=>{
 const p=producer(),t=task();t.messages.push(message('latest','new reply'));p.summary(t);
 t.messages[0].text+='more';p.transcriptChanged(t,{kind:'appendText',messageId:'m',offset:5,text:'more'});
 assert.equal(p.summary(t).lastAssistantPreview,'new reply');
});

test('oversize_append_does_not_copy_the_full_current_message_to_check_suffix',()=>{
 const p=producer(),t=task();p.summary(t);const huge='界'.repeat(100000);t.messages[0].text+=huge;
 const original=String.prototype.slice;let fullSuffixReads=0;
 String.prototype.slice=function(start,end){if(this.length>MAX_SAFE_TEST_LENGTH&&start===5&&end===undefined)fullSuffixReads++;return original.call(this,start,end);};
 try {assert.equal(p.transcriptChanged(t,{kind:'appendText',messageId:'m',offset:5,text:huge}).kind,'invalidate');}finally{String.prototype.slice=original;}
 assert.equal(fullSuffixReads,0);
});
const MAX_SAFE_TEST_LENGTH=10000;

test('snapshot_nested_projection_omits_opaque_extensions_without_mutating_profile',()=>{
 const p=producer(),state={tasks:[],projects:[{id:'p',name:'Project',path:'fixture',private:'secret'}],settings:{reducedMotion:false,apiKey:'secret'},codex:{status:'connected',rpcToken:'secret'},missions:[{id:'mission',projectId:'p',private:'secret',attempts:[{id:'attempt',rpcToken:'secret',taskIds:[]}]}],world:{residents:[{id:'robin',name:'Robin',secret:'private'}],jobs:[]}};
 const s=p.snapshot(state);assert.equal(JSON.stringify(s).includes('secret'),false);assert.equal(state.projects[0].private,'secret');
 assert.equal(s.missions[0].attempts[0].id,'attempt');
});

test('summary_scalar_fields_cannot_forward_nested_private_objects',()=>{
 const p=producer(),t=task();t.error={rpcToken:'private'};t.tokenUsage={total:{totalTokens:{secret:'private'}}};
 const s=p.summary(t);assert.equal(s.error,undefined);assert.equal(s.tokenUsage.total.totalTokens,undefined);
});

test('deleted_task_invalidates_cursor_and_project_membership_precedes_stale_summary',()=>{
 const p=producer(),t=task(),state={tasks:[t],projects:[{id:'p'}]};const s=p.summary(t);
 const req={projectId:'p',taskId:'t',epoch:'session',revision:s.transcriptRevision,direction:'older'};
 assert.equal(p.page(state,req).segments[0].text,'hello');
 assert.throws(()=>p.page(state,{...req,projectId:'else',revision:0}),/project|membership/i);
 state.tasks=[];p.forgetTask('t');assert.throws(()=>p.page(state,req),/task|deleted/i);
});
