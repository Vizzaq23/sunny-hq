const {test}=require('node:test');
const assert=require('node:assert/strict');
let api={};try{api=require('../src/transcriptState.ts');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const setup=()=>{assert.equal(typeof api.createTranscriptState,'function','transcript reducer exists');return api.createTranscriptState();};
const identity=(taskId='t',revision=1)=>({projectId:'p',taskId,epoch:'e',revision});
const select=(s,id=identity())=>api.transcriptReducer(s,{type:'select',selection:id,sequence:0});
const segment=(text='hello',extra={})=>({messageId:'m',role:'assistant',time:1,offset:0,text,totalLength:text.length,...extra});
const load=(s,segments=[segment()],extra={})=>{
 const request={id:1,selection:s.selection,direction:'older'};
 s=api.transcriptReducer(s,{type:'request',request});
 return api.transcriptReducer(s,{type:'page',request,page:{epoch:'e',taskId:'t',revision:1,segments,complete:true,...extra}});
};
const delta=(extra={})=>({epoch:'e',sequence:1,taskId:'t',baseRevision:1,revision:2,kind:'appendText',messageId:'m',offset:5,text:'!',...extra});

test('late_initial_snapshot_does_not_replace_newer_event',()=>{
 setup();let s=api.publicStateReducer(null,{type:'snapshot',snapshot:{epoch:'e',sequence:0,taskSummaries:[{id:'t',transcriptRevision:1}]}});
 s=api.publicStateReducer(s,{type:'event',event:{type:'task',epoch:'e',sequence:1,data:{id:'t',transcriptRevision:2}}});
 assert.equal(api.publicStateReducer(s,{type:'snapshot',snapshot:{epoch:'e',sequence:0,taskSummaries:[{id:'t',transcriptRevision:1}]}}),s);
 assert.equal(s.snapshot.taskSummaries[0].transcriptRevision,2);
});
test('events_before_initial_snapshot_preserve_metadata_and_newer_task_revision',()=>{
 setup();let s=api.publicStateReducer(null,{type:'event',event:{type:'task',epoch:'e',sequence:1,data:{id:'t',transcriptRevision:2}}});
 s=api.publicStateReducer(s,{type:'snapshot',snapshot:{epoch:'e',sequence:0,projects:[{id:'p'}],taskSummaries:[{id:'t',transcriptRevision:1},{id:'other',transcriptRevision:1}]}});
 assert.equal(s.snapshot.sequence,1);assert.equal(s.snapshot.taskSummaries.find(t=>t.id==='t').transcriptRevision,2);assert.equal(s.snapshot.taskSummaries.length,2);assert.equal(s.snapshot.projects[0].id,'p');
});
test('retired_epoch_snapshot_cannot_replace_restarted_public_state',()=>{
 setup();let s=api.publicStateReducer(null,{type:'snapshot',snapshot:{epoch:'e',sequence:2,taskSummaries:[]}});
 s=api.publicStateReducer(s,{type:'snapshot',snapshot:{epoch:'new',sequence:0,taskSummaries:[]}});
 assert.equal(api.publicStateReducer(s,{type:'snapshot',snapshot:{epoch:'e',sequence:3,taskSummaries:[]}}),s);
});
test('live_restart_after_early_event_rejects_old_pending_initial_snapshot',()=>{
 setup();let s=api.publicStateReducer(null,{type:'event',event:{epoch:'e',sequence:1,type:'task',data:{id:'t',transcriptRevision:1}}});
 s=api.publicStateReducer(s,{type:'snapshot',snapshot:{epoch:'new',sequence:0,taskSummaries:[]}});
 assert.equal(api.publicStateReducer(s,{type:'snapshot',snapshot:{epoch:'e',sequence:0,taskSummaries:[]}}),s);
});
test('old_page_cannot_replace_new_selection',()=>{
 let s=select(setup());const request={id:1,selection:s.selection,direction:'older'};s=api.transcriptReducer(s,{type:'request',request});s=select(s,identity('other'));
 assert.equal(api.transcriptReducer(s,{type:'page',request,page:{epoch:'e',taskId:'t',revision:1,segments:[segment()],complete:true}}),s);
});
test('stream_edit_during_load_invalidates_stale_page',()=>{
 let s=select(setup());const request={id:1,selection:s.selection,direction:'older'};s=api.transcriptReducer(s,{type:'request',request});s=api.transcriptReducer(s,{type:'event',event:{...delta(),kind:'invalidate'}});
 assert.equal(s.needsReload,true);assert.equal(s.selection.revision,2);
 assert.equal(api.transcriptReducer(s,{type:'page',request,page:{epoch:'e',taskId:'t',revision:1,segments:[segment()],complete:true}}),s);
});
test('missing_history_has_visible_recovery',()=>{
 let s=select(setup());const request={id:1,selection:s.selection,direction:'older'};s=api.transcriptReducer(s,{type:'request',request});s=api.transcriptReducer(s,{type:'failure',request,error:'History unavailable; retry'});
 assert.equal(s.loading,false);assert.match(s.error,/retry/);assert.deepEqual(api.transcriptSegments(s),[]);
});
test('stale_page_from_restarted_session_requires_snapshot_recovery_without_retry_loop',()=>{
 let s=select(setup());const request={id:1,selection:s.selection,direction:'older'};s=api.transcriptReducer(s,{type:'request',request});
 s=api.transcriptReducer(s,{type:'page',request,page:{stale:true,epoch:'restarted',taskId:'t',revision:1,summary:{transcriptRevision:1}}});
 assert.equal(s.needsReload,false);assert.equal(s.loading,false);assert.match(s.error,/session/i);
});
test('append_chain_preserves_readable_older_pages_and_gap_resyncs',()=>{
 let s=load(select(setup()),[segment()],{previousCursor:{epoch:'e',taskId:'t',revision:1,messageId:'m',offset:0}});
 s=api.transcriptReducer(s,{type:'event',event:delta()});assert.equal(api.transcriptSegments(s)[0].text,'hello!');assert.equal(s.pages[0].previousCursor.revision,2);
 s=api.transcriptReducer(s,{type:'event',event:delta({sequence:2,baseRevision:2,revision:3,offset:6,text:'?'})});assert.equal(api.transcriptSegments(s)[0].text,'hello!?');
 s=api.transcriptReducer(s,{type:'event',event:delta({sequence:4,baseRevision:3,revision:4,offset:7})});assert.equal(s.needsReload,true);assert.deepEqual(s.pages,[]);
});
test('unrelated_events_advance_sequence_and_duplicate_events_are_ignored',()=>{
 let s=load(select(setup()));s=api.transcriptReducer(s,{type:'event',event:{epoch:'e',sequence:1,type:'persistence'}});
 s=api.transcriptReducer(s,{type:'event',event:delta({sequence:2})});assert.equal(api.transcriptSegments(s)[0].text,'hello!');assert.equal(api.transcriptReducer(s,{type:'event',event:delta({sequence:2})}),s);
});
test('append_updates_partial_tail_length_without_inventing_missing_text',()=>{
 let s=load(select(setup()),[segment('old',{totalLength:20})]);s=api.transcriptReducer(s,{type:'event',event:delta({offset:20})});
 assert.equal(api.transcriptSegments(s)[0].text,'old');assert.equal(api.transcriptSegments(s)[0].totalLength,21);assert.equal(s.needsReload,false);
});
test('bad_offsets_surrogate_join_and_replacements_require_reload',()=>{
 for(const [text,d] of [['hello',delta({offset:4})],['\ud83d',delta({offset:1,text:'\ude00'})],['hello',delta({kind:'invalidate'})]]){
  let s=load(select(setup()),[segment(text)]);s=api.transcriptReducer(s,{type:'event',event:d});assert.equal(s.needsReload,true);
 }
});
test('page_cache_is_bounded_and_complete_unicode_segments_remain_in_order',()=>{
 let s=select(setup());for(let i=0;i<8;i++){
  const request={id:i,selection:s.selection,direction:'older'};s=api.transcriptReducer(s,{type:'request',request});s=api.transcriptReducer(s,{type:'page',request,page:{epoch:'e',taskId:'t',revision:1,segments:[segment('😀',{offset:i*2,totalLength:16})],complete:false}});
 }
 assert.equal(s.pages.length,3);assert.deepEqual(api.transcriptSegments(s).map(s=>s.offset),[10,12,14]);
});
test('old_epoch_events_do_not_reenter_after_restart',()=>{
 let s=load(select(setup()));s=select(s,{...identity(),epoch:'new'});assert.equal(api.transcriptReducer(s,{type:'event',event:delta()}),s);
});

test('navigation_preserves_unsent_draft_and_loader_exposes_retry_without_cross_task_text',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
 const path=require('node:path').join(__dirname,'../src/useTaskTranscript.ts');
 assert.ok(fs.existsSync(path),'selected task hook exists');
 const slots=[],effects=[];let index=0,render;
 const react={useRef(value){const i=index++;return slots[i]??(slots[i]={current:value});},useState(value){const i=index++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useCallback(fn){index++;return fn;},useEffect(fn,deps){const i=index++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}}};
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>id==='react'?react:api,TextEncoder});
 let handler;const pending=[],draft={text:'Unsent captain message'};
 const options={...identity(),sequence:0,invoke:async(action,args)=>new Promise((resolve,reject)=>pending.push({args,resolve,reject})),subscribe:fn=>{handler=fn;return()=>{};}};
 render=o=>{index=0;const view=module.exports.useTaskTranscript(o);while(effects.length)effects.shift()();return view;};
 render(options);assert.equal(pending[0].args.taskId,'t');
 render({...options,taskId:'other'});pending[0].resolve({epoch:'e',taskId:'t',revision:1,segments:[segment('wrong task')],complete:true});await Promise.resolve();await Promise.resolve();
 let view=render({...options,taskId:'other'});assert.deepEqual(Array.from(view.segments),[]);assert.equal(draft.text,'Unsent captain message');
 pending[1].reject(Error('History unavailable'));await new Promise(setImmediate);view=render({...options,taskId:'other'});assert.match(view.error,/unavailable/);assert.equal(typeof view.retry,'function');
 const previousCursor={epoch:'e',taskId:'other',revision:1,messageId:'m',offset:0};
 view.retry();assert.equal(pending.length,3);pending[2].resolve({epoch:'e',taskId:'other',revision:1,segments:[segment('right task')],previousCursor,complete:true});await new Promise(setImmediate);
 view=render({...options,taskId:'other'});assert.equal(view.segments[0].text,'right task');assert.equal(draft.text,'Unsent captain message');assert.equal(typeof handler,'function');
 view.loadOlder();assert.deepEqual(pending[3].args.cursor,previousCursor);pending[3].reject(Error('Retry older history'));await new Promise(setImmediate);
 view=render({...options,taskId:'other'});view.retry();assert.deepEqual(pending[4].args.cursor,previousCursor,'retry resumes the failed history position');
});
