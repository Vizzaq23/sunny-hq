const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Growth}=require('../desktop/growth.cjs');
const {LocalCrew,initialLocalCrew,conversationContext}=require('../desktop/local-crew.cjs');
const {Hub}=require('../desktop/hub.cjs');
const scope={crewId:'franky',projectId:'p'};
test('supported answer-only mode avoids a thinking-only output limit and retains only the answer',async()=>{
 const f=await fixture({request:async(route,body)=>{
  if(route==='tags')return {models:[{name:'fixture:local',size:1,details:{format:'gguf'}}]};
  if(route==='show')return {details:{format:'gguf'},thinking:{values:[false,true],default:true}};
  return body.think===false?{done:true,message:{role:'assistant',content:'A complete bounded answer.',thinking:'Internal fixture trace'}}:{done:true,done_reason:'length',message:{role:'assistant',content:'',thinking:'Internal fixture trace'}};
 }});
 await f.local.ask({...scope,prompt:'Review the boundary.'});
 assert.equal(f.local.profile('franky').sessions[0].status,'finished');assert.equal(f.calls.find(c=>c.route==='chat').body.think,false);assert.ok(!JSON.stringify(f.saved()).includes('Internal fixture trace'));
});
test('missing or unsupported thinking controls retain the server default',async()=>{
 for(const thinking of [undefined,{values:['low','medium','high']},{values:['false']},{values:[true]},{values:false}]){
  const f=await fixture({request:async(route,body)=>{
   if(route==='tags')return {models:[{name:'fixture:local',size:1,details:{format:'gguf'}}]};
   if(route==='show')return {details:{format:'gguf'},capabilities:['thinking'],thinking};
   assert.ok(!Object.hasOwn(body,'think'));return {done:true,message:{role:'assistant',content:'Uses the supported default.'}};
  }});
  await f.local.ask({...scope,prompt:'Review.'});
 }
});
async function fixture(options={}){
 const calls=[],growth=new Growth();let saved;
 const hub={growth,state:{growth:growth.data,localCrew:initialLocalCrew()},project(id){if(!['p','q'].includes(id))throw Error('Unknown project');return {id};},persist(){saved=structuredClone({localCrew:this.state.localCrew,growth:this.growth.data});},changed(){}};
 const request=async(route,body,signal)=>{calls.push({route,body,signal});if(options.request)return options.request(route,body,signal);if(route==='tags')return {models:[{name:'fixture:local',size:100,details:{format:'gguf'}}]};if(route==='show')return {details:{format:'gguf'}};return {done:true,message:{role:'assistant',content:'Proposed fix; tests have not been run.'}};};
 const local=new LocalCrew(hub,{request,timeoutMs:options.timeoutMs??1000});
 await local.configure({crewId:'franky',model:'fixture:local',skills:['review','testing']});
 return {local,hub,calls,saved:()=>saved};
}
test('a completed fixture response persists the selected model, scoped recall and attribution',async()=>{
 const f=await fixture();await f.local.teach({...scope,text:'Use focused recovery tests.'});
 await f.local.ask({...scope,prompt:'Review this function.'});
 const chat=f.calls.find(c=>c.route==='chat').body;
 assert.match(chat.messages[0].content,/focused recovery tests/);assert.match(chat.messages[0].content,/no tools, filesystem access/);assert.equal(chat.tools,undefined);
 assert.equal(f.saved().localCrew.profiles.franky.sessions[0].status,'finished');assert.equal(f.saved().localCrew.profiles.franky.sessions[0].messages[1].model,'fixture:local');
 assert.equal(f.hub.growth.profile('franky').conversations,1);
 const restored=initialLocalCrew(f.saved().localCrew);assert.equal(restored.profiles.franky.sessions[0].messages.length,2);
});
test('project and character histories remain separate and corrections replace old notes',async()=>{
 const f=await fixture();const note=await f.local.teach({...scope,text:'Old project preference.'});f.hub.growth.note('franky','New project preference.',note.id);
 await f.local.ask({...scope,prompt:'Project p secret.'});await f.local.ask({...scope,projectId:'q',prompt:'Review q.'});
 const content=JSON.stringify(f.calls.filter(c=>c.route==='chat').at(-1).body);assert.doesNotMatch(content,/Project p secret|project preference/);
 assert.match(f.hub.growth.context('franky','preference','p','local'),/New project preference/);assert.doesNotMatch(f.hub.growth.context('franky','preference','p','local'),/Old project preference/);
 assert.equal(f.hub.growth.context('zoro','preference','p'),'');
 f.hub.growth.forget('franky',note.id);assert.doesNotMatch(f.hub.growth.context('franky','preference','p','local'),/New project preference/);
});
test('local identity retains the character without importing execution-role instructions',async()=>{
 const f=await fixture();await f.local.ask({...scope,prompt:'Review my supplied code.'});
 const system=f.calls.find(c=>c.route==='chat').body.messages[0].content;
 assert.match(system,/portraying franky/);assert.ok(system.includes(require('../desktop/crew.cjs').personalities.franky));
 assert.match(system,/cannot inspect a repository, edit files or run tests/);assert.ok(!system.includes('run relevant deterministic checks'));
 assert.match(require('../desktop/crew.cjs').characterInstructions('franky','builder'),/run relevant deterministic checks/,'executing mission guidance remains intact');
});
test('disabled memory neither injects notes nor learns a local exchange',async()=>{
 const f=await fixture();await f.local.teach({...scope,text:'Hidden preference.'});f.hub.growth.data.enabled=false;await f.local.ask({...scope,prompt:'Review.'});
 assert.doesNotMatch(JSON.stringify(f.calls.at(-1).body),/Hidden preference/);assert.equal(f.hub.growth.profile('franky').conversations,0);
});
test('local lessons and episodes never enter default Codex or router recall',async()=>{
 const f=await fixture();await f.local.teach({...scope,text:'Private local lesson.'});await f.local.ask({...scope,prompt:'Private local discussion.'});
 const restored=new Growth(f.saved().growth);
 assert.equal(restored.context('franky','Private','p'),'');assert.deepEqual(restored.contextCandidates('franky','Private','p'),[]);
 assert.match(restored.context('franky','Private','p','local'),/Private local lesson/);
 assert.doesNotMatch(restored.context('franky','Private','p','local'),/Private local discussion/);assert.ok(restored.profile('franky').memories.some(m=>m.text.includes('Private local discussion')));
});
test('untrusted arguments and unknown projects are rejected before contacting the model',async()=>{
 const f=await fixture();for(const bad of [{...scope,prompt:'x',endpoint:'https://example.com'}, {...scope,crewId:'__proto__',prompt:'x'}, {...scope,projectId:'unknown',prompt:'x'}, {...scope,prompt:'x'.repeat(16001)}, null])await assert.rejects(f.local.ask(bad));
 await assert.rejects(()=>f.local.configure({crewId:'franky',model:'example-cloud',skills:['review']}));await assert.rejects(()=>f.local.configure({crewId:'franky',model:'fixture:local',skills:['shell']}));assert.equal(f.calls.length,0);
});
test('remote model metadata is rejected before any private prompt is sent',async()=>{
 const f=await fixture({request:async route=>route==='tags'?{models:[{name:'fixture:local',size:100,details:{format:'gguf'}}]}:{details:{format:'gguf'},remote_host:'https://cloud.example'}});
 await assert.rejects(f.local.ask({...scope,prompt:'Private source.'}),/local GGUF/);assert.deepEqual(f.calls.map(c=>c.route),['tags','show']);assert.equal(f.hub.growth.profile('franky').conversations,0);
});
test('missing models and malformed responses are failures without learned experience',async()=>{
 const missing=await fixture({request:async()=>({models:[]})});await assert.rejects(missing.local.ask({...scope,prompt:'Hi'}),/not installed/);
 for(const result of [{done:false},{done:true,message:{role:'assistant',content:'x',tool_calls:[{function:{name:'run'}}]}},{done:true,message:{role:'assistant',content:'x'.repeat(16001)}}]){
  const f=await fixture({request:async route=>route==='tags'?{models:[{name:'fixture:local',size:100,details:{format:'gguf'}}]}:route==='show'?{details:{format:'gguf'}}:result});await assert.rejects(f.local.ask({...scope,prompt:'Hi'}),/unsupported/);assert.equal(f.hub.growth.profile('franky').conversations,0);assert.equal(f.local.active,null);
 }
});
test('output-limit completion is not learned or treated as a finished answer',async()=>{
 const f=await fixture({request:async route=>route==='tags'?{models:[{name:'fixture:local',size:100,details:{format:'gguf'}}]}:route==='show'?{details:{format:'gguf'}}:{done:true,done_reason:'length',message:{role:'assistant',content:'Half a patch...'}}});
 await assert.rejects(f.local.ask({...scope,prompt:'Review this large module.'}),/output limit/);
 assert.equal(f.local.profile('franky').sessions[0].status,'failed');assert.equal(f.local.profile('franky').sessions[0].messages.length,1);assert.equal(f.hub.growth.profile('franky').conversations,0);
});
test('source requests validate crew and project and cannot trigger model execution',async()=>{
 const f=await fixture();assert.throws(()=>f.local.source({...scope,projectId:'unknown',path:'sample.ts'}),/Unknown project/);
 assert.throws(()=>f.local.source({...scope,projectId:' p ',path:'sample.ts'}),/Invalid project/);
 assert.throws(()=>f.local.source({...scope,path:'sample.ts',endpoint:'https://example.com'}),/Invalid/);assert.equal(f.calls.length,0);
});
test('stop prevents late response completion and blocks duplicate work while unwinding',async()=>{
 let resolve,started;const ready=new Promise(r=>started=r);const f=await fixture({request:async route=>{if(route==='tags')return {models:[{name:'fixture:local',size:100,details:{format:'gguf'}}]};if(route==='show')return {details:{format:'gguf'}};started();return new Promise(r=>resolve=r);}});
 const reply=f.local.ask({...scope,prompt:'Review.'});await ready;
 await assert.rejects(f.local.ask({...scope,prompt:'Duplicate.'}),/already running/);await assert.rejects(()=>f.local.clear(scope),/Stop/);
 await f.local.stop(scope);resolve({done:true,message:{role:'assistant',content:'Late reply'}});await assert.rejects(reply);
 assert.equal(f.hub.state.localCrew.profiles.franky.sessions[0].status,'interrupted');assert.equal(f.hub.state.localCrew.profiles.franky.sessions[0].messages.length,1);assert.equal(f.hub.growth.profile('franky').conversations,0);
});
test('timeouts abort the request without retry',async()=>{
 const f=await fixture({timeoutMs:15,request:(_route,_body,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Aborted')),{once:true}))});
 await assert.rejects(f.local.ask({...scope,prompt:'Hi'}));assert.match(f.hub.state.localCrew.profiles.franky.sessions[0].error,/timed out/);assert.equal(f.calls.length,1);
});
test('failed persistence prevents network activity and rolls back setup and lessons',async()=>{
 const f=await fixture();f.hub.persist=()=>{throw Error('Disk full');};
 await assert.rejects(()=>f.local.configure({crewId:'franky',model:'other:local',skills:['debugging']}),/Disk full/);assert.equal(f.local.profile('franky').model,'fixture:local');
 await assert.rejects(()=>f.local.teach({...scope,text:'Unsaved'}),/Disk full/);assert.equal(f.hub.growth.profile('franky').memories.length,0);
 await assert.rejects(f.local.ask({...scope,prompt:'Review'}),/Disk full/);assert.equal(f.calls.length,0);assert.equal(f.local.profile('franky').sessions.length,0);
});
test('restart interrupts in-flight work and clear removes only the chosen conversation',async()=>{
 const f=await fixture();await f.local.ask({...scope,prompt:'p'});await f.local.ask({...scope,projectId:'q',prompt:'q'});
 f.local.profile('franky').sessions[0].status='working';const restored=initialLocalCrew(f.hub.state.localCrew);assert.equal(restored.profiles.franky.sessions[0].status,'interrupted');
 await f.local.clear(scope);assert.equal(f.local.profile('franky').sessions.length,1);assert.equal(f.local.profile('franky').sessions[0].projectId,'q');assert.equal(f.hub.growth.profile('franky').conversations,2);
 assert.deepEqual(initialLocalCrew(),{version:1,profiles:{}});assert.deepEqual(initialLocalCrew({version:999}),{version:1,profiles:{}});
});
test('completion persistence failure does not leave learned experience in memory',async()=>{
 const f=await fixture();let saves=0;const save=f.hub.persist.bind(f.hub);f.hub.persist=()=>{if(++saves>1)throw Error('Completion disk failure');save();};
 await assert.rejects(f.local.ask({...scope,prompt:'Review'}),/Completion disk failure/);
 assert.equal(f.hub.growth.profile('franky').conversations,0);assert.equal(f.local.profile('franky').sessions[0].status,'failed');
 assert.equal(f.local.profile('franky').sessions[0].messages.length,1);
});
test('failed start persistence preserves a previously finished conversation exactly',async()=>{
 const f=await fixture();await f.local.ask({...scope,prompt:'First question'});const before=structuredClone(f.local.profile('franky').sessions),calls=f.calls.length;
 f.hub.persist=()=>{throw Error('Disk full');};await assert.rejects(f.local.ask({...scope,prompt:'Must not enter history'}),/Disk full/);
 assert.deepEqual(f.local.profile('franky').sessions,before);assert.equal(f.calls.length,calls);assert.equal(f.local.active,null);
});
test('model history contains only completed pairs and the current question, never unanswered prompts',async()=>{
 const user=text=>({role:'user',text}),assistant=text=>({role:'assistant',text});
 const messages=[assistant('Orphan'),user('Completed'),assistant('Answer'),user('Interrupted request'),user('Failed request'),user('Current')];
 assert.deepEqual(conversationContext(messages),[{role:'user',content:'Completed'},{role:'assistant',content:'Answer'},{role:'user',content:'Current'}]);
 assert.deepEqual(conversationContext([user('x'.repeat(15000)),assistant('y'.repeat(10000)),user('Current')]),[{role:'user',content:'Current'}]);
});
test('a failed question is retained visibly but not replayed on the next model request',async()=>{
 const f=await fixture();let fail=true;const request=f.local.request;f.local.request=async(route,...args)=>{if(route==='chat'&&fail){fail=false;throw Error('Interrupted fixture');}return request(route,...args);};
 await assert.rejects(f.local.ask({...scope,prompt:'Old unanswered instruction'}));await f.local.ask({...scope,prompt:'New question'});
 const chat=f.calls.filter(c=>c.route==='chat').at(-1).body;assert.doesNotMatch(JSON.stringify(chat.messages),/Old unanswered instruction/);
 assert.equal(f.local.profile('franky').sessions[0].messages[0].text,'Old unanswered instruction');
});
test('recall preview matches budgeted model context, stays scoped and makes no model call',async()=>{
 const f=await fixture();for(let n=0;n<6;n++)await f.local.teach({...scope,text:`Local lesson ${n}: `+'recovery '.repeat(180)});
 await f.local.teach({...scope,projectId:'q',text:'Other project secret'});f.hub.growth.note('zoro','Other crew secret');
 const preview=f.local.recall({...scope,query:'recovery'});assert.equal(f.calls.length,0);assert.ok(preview.memories.length>0&&preview.memories.length<6);
 await f.local.ask({...scope,prompt:'recovery'});const system=f.calls.find(c=>c.route==='chat').body.messages[0].content;
 for(const memory of preview.memories)assert.ok(system.includes(JSON.stringify(memory.text)));
 assert.doesNotMatch(system,/Other project secret|Other crew secret/);
 f.hub.growth.data.enabled=false;assert.deepEqual(f.local.recall({...scope,query:'recovery'}),{enabled:false,memories:[]});
 assert.throws(()=>f.local.recall({...scope,query:'x'.repeat(16001)}),/Invalid recall/);
});
test('Hub persistence includes local profiles and recovers interrupted sessions without provider calls',async t=>{
 const localCrew={version:1,profiles:{franky:{model:'fixture:local',skills:['review'],sessions:[{projectId:'p',status:'working',messages:[]}]}}};let saved;
 const hub=new Hub({home:process.cwd(),store:require('./helpers/receipt-store.cjs').receiptStore({load:()=>({localCrew}),save:value=>saved=structuredClone(value),close(){}}),catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});t.after(()=>hub.close());
 assert.equal(hub.state.localCrew.profiles.franky.sessions[0].status,'interrupted');await hub.persist();assert.equal(saved.localCrew.profiles.franky.model,'fixture:local');assert.equal(hub.client.connected,false);
});

test('an asynchronous initial receipt gates every model request and Stop cancels before dispatch',async()=>{
 const f=await fixture();let release;const pending=new Promise(resolve=>release=resolve);const save=f.hub.persist.bind(f.hub);let saves=0;
 f.hub.persist=async()=>{if(++saves===1)await pending;save();};
 const reply=f.local.ask({...scope,prompt:'Do not dispatch before durable storage.'});const rejected=assert.rejects(reply,/abort/i);
 assert.equal(f.calls.length,0);await assert.rejects(f.local.configure({crewId:'zoro',model:'fixture:local',skills:['review']}),/still being saved/);
 await f.local.stop(scope);release();await rejected;assert.equal(f.calls.length,0);assert.equal(f.local.active,null);
});

test('a delayed setup failure is awaited and rolls back only its own setup',async()=>{
 const f=await fixture();f.hub.persist=async()=>{await new Promise(resolve=>setImmediate(resolve));throw Error('Async disk failure');};
 await assert.rejects(f.local.configure({crewId:'franky',model:'other:local',skills:['review']}),/Async disk/);
 assert.equal(f.local.profile('franky').model,'fixture:local');assert.equal(f.local.saving,0);
});

test('a failed async lesson save preserves unrelated journal edits',async()=>{
 const f=await fixture();let reject;f.hub.persist=()=>new Promise((_resolve,r)=>reject=r);
 const lesson=f.local.teach({...scope,text:'Unsaved local lesson'});const failed=assert.rejects(lesson,/Disk/);
 f.hub.growth.note('franky','Independent captain correction');f.hub.growth.note('zoro','Independent reviewer note');reject(Error('Disk full'));await failed;
 assert.deepEqual(f.hub.growth.profile('franky').memories.map(m=>m.text),['Independent captain correction']);assert.equal(f.hub.growth.profile('zoro').memories.length,1);
});

test('a failed async completion save preserves unrelated learning and corrections',async()=>{
 const f=await fixture();const save=f.hub.persist.bind(f.hub);let writes=0;
 f.hub.persist=async()=>{if(++writes===2){f.hub.growth.note('franky','Independent correction');f.hub.growth.learn({id:'independent',crewId:'franky',projectId:'p',status:'finished',messages:[{id:'q',role:'user',text:'Other question'},{id:'a',role:'assistant',text:'Other answer'}]},'a');throw Error('Completion save failed');}save();};
 await assert.rejects(f.local.ask({...scope,prompt:'Review'}),/Completion save/);const profile=f.hub.growth.profile('franky');
 assert.equal(profile.conversations,1);assert.equal(profile.xp,10);assert.ok(profile.memories.some(m=>m.text==='Independent correction'));assert.ok(profile.memories.some(m=>m.id==='turn:independent:a'));assert.equal(profile.memories.length,2);
});

test('shutdown and storage recovery guards prevent local inference',async()=>{
 const f=await fixture();f.hub.assertOpenForEffect=()=>{throw Error('Storage needs recovery');};await assert.rejects(f.local.ask({...scope,prompt:'Review'}),/Storage needs recovery/);assert.equal(f.calls.length,0);
});

test('public projection includes bounded local fields and privacy labels without opaque metadata',async()=>{
 const f=await fixture();await f.local.teach({...scope,text:'Keep this local'});await f.local.ask({...scope,prompt:'Review'});
 f.local.profile('franky').privateExtension='not public';f.local.profile('franky').sessions[0].internalSecret='not public';
 const snapshot=require('../desktop/state-projection.cjs').createStateProjection().snapshot({...f.hub.state,tasks:[]});
 assert.equal(snapshot.localCrew.profiles.franky.sessions[0].messages.length,2);assert.equal(snapshot.growth.profiles.franky.memories[0].source.localOnly,true);assert.doesNotMatch(JSON.stringify(snapshot),/not public/);
});

test('fresh local recall uses captain lessons instead of reinforcing unverified generated answers',async()=>{
 const f=await fixture();await f.local.ask({...scope,prompt:'An earlier question'});await f.local.teach({...scope,text:'Use reviewed corrections as guidance.'});await f.local.clear(scope);
 const preview=f.local.recall({...scope,query:'earlier question'});assert.equal(preview.memories.length,1);assert.equal(preview.memories[0].kind,'note');
 await f.local.ask({...scope,prompt:'A fresh question'});const body=f.calls.filter(c=>c.route==='chat').at(-1).body;
 assert.match(body.messages[0].content,/Use reviewed corrections/);assert.doesNotMatch(JSON.stringify(body),/An earlier question|Proposed fix/);
 assert.equal(f.hub.growth.profile('franky').memories.filter(m=>m.kind==='conversation').length,2,'history is preserved, not deleted');
});

test('profiles without local crew data remain additive only after the captain configures a crewmate',async t=>{
 const hub=new Hub({home:process.cwd(),store:require('./helpers/receipt-store.cjs').receiptStore({load:()=>({}),save(){},close(){}}),catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});t.after(()=>hub.close());
 assert.equal(Object.hasOwn(hub.persistedImage(),'localCrew'),false);await hub.localCrew.configure({crewId:'franky',model:'fixture:local',skills:['review']});assert.equal(hub.persistedImage().localCrew.profiles.franky.model,'fixture:local');
});

test('Stop cannot relabel a received answer while its durable completion is pending',async()=>{
 const f=await fixture();const save=f.hub.persist.bind(f.hub);let saves=0,release,arrived;const ready=new Promise(resolve=>arrived=resolve);
 f.hub.persist=async()=>{if(++saves===2){arrived();await new Promise(resolve=>release=resolve);}save();};
 const reply=f.local.ask({...scope,prompt:'Review'});await ready;await assert.rejects(f.local.stop(scope),/arrived and is being saved/);release();await reply;
 assert.equal(f.local.profile('franky').sessions[0].status,'finished');assert.equal(f.hub.growth.profile('franky').conversations,1);
});

test('an uncertain initial receipt leaves a recoverable interrupted question and never dispatches',async()=>{
 const f=await fixture();f.hub.persist=async()=>{throw Object.assign(Error('Uncertain receipt'),{uncertain:true});};
 await assert.rejects(f.local.ask({...scope,prompt:'Review'}),/Uncertain/);assert.equal(f.calls.length,0);assert.equal(f.local.active,null);assert.equal(f.local.profile('franky').sessions[0].status,'interrupted');
 assert.match(f.local.profile('franky').sessions[0].error,/No local inference/);
});

test('shutdown during completion persistence retains the already received answer',async()=>{
 const f=await fixture();const save=f.hub.persist.bind(f.hub);let saves=0,release,arrived;const ready=new Promise(resolve=>arrived=resolve);
 f.hub.persist=async()=>{if(++saves===2){arrived();await new Promise(resolve=>release=resolve);}save();};
 const reply=f.local.ask({...scope,prompt:'Review'});await ready;f.local.close();release();await reply;
 assert.equal(f.local.profile('franky').sessions[0].status,'finished');assert.equal(f.hub.growth.profile('franky').conversations,1);
});

test('personal developer guidelines are bounded, local, crew-specific and survive restart',async()=>{
 const f=await fixture();await f.local.configure({crewId:'franky',model:'fixture:local',skills:['review'],instructions:'Use complete runnable examples and explain tradeoffs.'});await f.local.ask({...scope,prompt:'Review'});
 const system=f.calls.find(c=>c.route==='chat').body.messages[0].content;assert.match(system,/Use complete runnable examples/);assert.ok(system.indexOf('LOCAL ADVISORY MODE:')>system.indexOf('Use complete runnable examples'));
 assert.equal(initialLocalCrew(f.saved().localCrew).profiles.franky.instructions,'Use complete runnable examples and explain tradeoffs.');assert.equal(f.local.profile('zoro').instructions,'');assert.equal(f.hub.growth.context('franky','examples','p'),'');
 await assert.rejects(f.local.configure({crewId:'franky',model:'fixture:local',skills:['review'],instructions:'x'.repeat(4001)}),/4,000/);await assert.rejects(f.local.configure({crewId:'franky',model:'fixture:local',skills:['review'],instructions:{text:'invalid'}}),/guidelines/);
 const saved=f.saved().localCrew;delete saved.profiles.franky.instructions;assert.equal(initialLocalCrew(saved).profiles.franky.instructions,'');saved.profiles.franky.instructions='x'.repeat(4001);assert.equal(initialLocalCrew(saved).profiles.franky.sessions[0].messages.length,2);
});

test('repeated Stop remains idempotent while an aborted reply unwinds',async()=>{
 let started,finish;const ready=new Promise(resolve=>started=resolve);const f=await fixture({request:async route=>{if(route==='tags')return {models:[{name:'fixture:local',size:1,details:{format:'gguf'}}]};if(route==='show')return {details:{format:'gguf'}};started();return new Promise(resolve=>finish=resolve);}});
 const reply=f.local.ask({...scope,prompt:'Review'});const stopped=assert.rejects(reply);await ready;await f.local.stop(scope);await f.local.stop(scope);finish({done:true,message:{role:'assistant',content:'Late'}});await stopped;assert.equal(f.hub.growth.profile('franky').conversations,0);
});

test('failed completion rolls back its experience even if its provisional episode was forgotten',async()=>{
 const f=await fixture();const save=f.hub.persist.bind(f.hub);let writes=0;f.hub.persist=async()=>{if(++writes===2){const episode=f.hub.growth.profile('franky').memories.find(m=>m.kind==='conversation');f.hub.growth.forget('franky',episode.id);throw Error('Disk full');}save();};
 await assert.rejects(f.local.ask({...scope,prompt:'Review'}),/Disk full/);assert.equal(f.hub.growth.profile('franky').xp,0);assert.equal(f.hub.growth.profile('franky').conversations,0);
});

test('failed learning restores episodes evicted provisionally at the retention boundary',async()=>{
 const f=await fixture();for(let n=0;n<150;n++)f.hub.growth.learn({id:'prior-'+n,crewId:'franky',projectId:'p',status:'finished',messages:[{id:'q',role:'user',text:'Prior question'},{id:'a',role:'assistant',text:'Prior answer'}]},'a');
 const before=f.hub.growth.profile('franky').memories.map(m=>m.id),save=f.hub.persist.bind(f.hub);let writes=0;f.hub.persist=async()=>{if(++writes===2)throw Error('Disk full');save();};
 await assert.rejects(f.local.ask({...scope,prompt:'Review'}),/Disk full/);assert.deepEqual(f.hub.growth.profile('franky').memories.map(m=>m.id),before);assert.equal(f.hub.growth.profile('franky').conversations,150);assert.equal(f.hub.growth.forgetListeners.size,0);
});

test('retention rollback preserves concurrent learning and honors forgetting an already-evicted episode',async()=>{
 const f=await fixture();const learn=id=>f.hub.growth.learn({id,crewId:'franky',projectId:'p',status:'finished',messages:[{id:'q',role:'user',text:'Question'},{id:'a',role:'assistant',text:'Answer'}]},'a');for(let n=0;n<150;n++)learn('prior-'+n);
 const save=f.hub.persist.bind(f.hub);let writes=0;f.hub.persist=async()=>{if(++writes===2){f.hub.growth.forget('franky','turn:prior-0:a');learn('independent');throw Error('Disk full');}save();};
 await assert.rejects(f.local.ask({...scope,prompt:'Review'}),/Disk full/);const profile=f.hub.growth.profile('franky');assert.equal(profile.memories.length,150);assert.ok(profile.memories.some(m=>m.id==='turn:independent:a'));assert.ok(profile.memories.some(m=>m.id==='turn:prior-1:a'));assert.ok(!profile.memories.some(m=>m.id==='turn:prior-0:a'));assert.equal(profile.conversations,151);assert.equal(f.hub.growth.forgetListeners.size,0);
});

test('manual code questions preserve significant leading indentation and trailing newlines',async()=>{
 const f=await fixture();const prompt='    def method(self):\n        return self.value\n';await f.local.ask({...scope,prompt});assert.equal(f.calls.find(c=>c.route==='chat').body.messages.at(-1).content,prompt);assert.equal(f.local.profile('franky').sessions[0].messages[0].text,prompt);
});

test('real isolated SQLite storage retains local setup and lessons and never replays interrupted work',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-local-sqlite-'));let hub,requests=0;
 t.after(async()=>{await hub?.close();fs.rmSync(root,{recursive:true,force:true});});
 async function boot(){
  const store=await require('../desktop/ordered-store.cjs').openOrderedStore({kind:'sqlite',file:path.join(root,'state.sqlite'),backupDir:path.join(root,'backups')});
  const client=new EventEmitter();client.connected=false;client.close=()=>{};
  let next;try{next=new Hub({home:root,store,catalog:{discoverProjects:()=>[{id:'p',path:root}],discoverTools:()=>[],discoverAutomations:()=>[]},fixtureDependencies:{client,islandFactory:()=>({close(){}})}});await next.initializeRecovery();}catch(error){await store.close();throw error;}
  next.localCrew.request=async route=>{requests++;return route==='tags'?{models:[{name:'fixture:local',size:1,details:{format:'gguf'}}]}:route==='show'?{details:{format:'gguf'}}:{done:true,message:{role:'assistant',content:'Synthetic SQLite fixture advice; no model ran.'}};};return next;
 }
 hub=await boot();await hub.localCrew.configure({crewId:'franky',model:'fixture:local',skills:['testing'],instructions:'Prefer complete tests.'});await hub.localCrew.teach({...scope,text:'This lesson stays local.'});await hub.localCrew.ask({...scope,prompt:'Synthetic SQLite fixture'});
 const session=hub.state.localCrew.profiles.franky.sessions[0];session.status='working';session.messages.push({id:'pending',role:'user',text:'Interrupted fixture question',time:Date.now()});await hub.persist();await hub.close();hub=await boot();
 const restored=hub.state.localCrew.profiles.franky;assert.equal(restored.instructions,'Prefer complete tests.');assert.equal(restored.model,'fixture:local');assert.equal(restored.sessions[0].status,'interrupted');assert.equal(restored.sessions[0].messages.length,3);assert.equal(requests,3,'restart never contacts the model');assert.equal(hub.localCrew.recall({...scope,query:'lesson'}).memories.length,1);assert.equal(hub.growth.context('franky','lesson','p'),'');assert.equal(hub.persistedImage().localCrew.profiles.franky.instructions,'Prefer complete tests.');
});
