const test=require('node:test');
const assert=require('node:assert/strict');
const {LocalCouncil,initialCouncils,parsePlan}=require('../desktop/local-council.cjs');
const {initialLocalCrew,defaults,localIdentity}=require('../desktop/local-crew.cjs');
const specialties=require('../desktop/local-specialties.json');
const {CREW_ROLES}=require('../desktop/crew-registry.cjs');
function fixture(reply){
 const calls=[];let saved;
 const hub={state:{world:{residents:[{id:'law',recruited:true}]},localCrew:{version:1,profiles:Object.fromEntries(Object.keys(specialties.crew).filter(id=>id!=='morgans').map(id=>[id,{model:'fixture:local',...defaults(id),sessions:[]}]))}},project(id){assert.equal(id,'p');return {id};},assertOpenForEffect(){if(this.quiescing)throw Error('Closing');},persist(){saved=structuredClone(this.state);},changed(){},localCrew:{async contribute(crewId,projectId,prompt,signal,mode){calls.push({crewId,projectId,prompt,signal,mode});if(reply)return reply(crewId,prompt,signal);return {model:'fixture:local',text:crewId==='luffy'&&prompt.startsWith('Plan ')?JSON.stringify({summary:'Build and verify.',assignments:[{crewId:'franky',objective:'Propose a small fix.'},{crewId:'usopp',objective:'Design regression checks.'}]}):'Evidence-limited proposal by '+crewId};}}};
 const council=new LocalCouncil(hub);hub.localCouncil=council;return {hub,council,calls,saved:()=>saved};
}
test('every island identity has a purpose-specific specialty matching the canonical roster',()=>{
 assert.deepEqual(Object.keys(specialties.crew).sort(),CREW_ROLES.map(item=>item.crewId).sort());
 for(const role of CREW_ROLES){const entry=specialties.crew[role.crewId];assert.ok(entry.role&&entry.guidelines&&entry.useWhen&&entry.deliverable&&entry.starter);assert.ok(entry.skills.length<=4&&entry.skills.length);for(const skill of entry.skills)assert.ok(specialties.skills[skill]?.description);}
 assert.notDeepEqual(defaults('robin').skills,defaults('franky').skills);
 assert.match(localIdentity('law'),/Systems diagnosis and analysis/);
 assert.match(specialties.crew.morgans.guidelines,/sanitized/);
});
test('existing personal setup survives role-default changes',()=>{
 const saved={version:1,profiles:{franky:{model:'fixture:local',skills:['review'],instructions:'My own instructions',sessions:[]}}};
 assert.deepEqual(initialLocalCrew(saved).profiles.franky,saved.profiles.franky);
});

test('Luffy sees actual selected skills and bounded role context for a maximum-length request',async()=>{
 const f=fixture();f.hub.state.localCrew.profiles.robin.skills=['writing'];
 const row=f.council.roster().find(item=>item.crewId==='robin');assert.deepEqual(row.skills,['writing']);assert.equal(row.useWhen,specialties.crew.robin.useWhen);
 assert.equal(f.council.roster().find(item=>item.crewId==='vivi').eligible,false);
 await f.council.start({projectId:'p',objective:'x'.repeat(6000)});
 assert.ok(f.calls[0].prompt.length<=16000);assert.ok(f.calls[0].prompt.includes(JSON.stringify(row)));
});

test('explicit skill refresh preserves personal models, blank/custom guidance, sessions and lessons',async()=>{
 const f=fixture();f.hub.localCrew.assertWritable=()=>{};f.hub.localCrew.models=async()=>[{name:'fixture:local'}];f.hub.localCrew.save=async()=>{};
 const sessions=[{projectId:'p',status:'finished',messages:[{text:'A saved conversation'}]}],growth={lesson:'Keep my personal lesson'};
 Object.assign(f.hub.state.localCrew.profiles.franky,{model:'personal:model',instructions:'My own instructions',skills:['writing'],sessions});
 f.hub.state.localCrew.profiles.robin.instructions='';f.hub.state.growth=growth;
 await f.council.setup({model:'fixture:local'});assert.deepEqual(f.hub.state.localCrew.profiles.franky.skills,['writing']);
 await f.council.setup({model:'fixture:local',refreshSkills:true});
 const profiles=f.hub.state.localCrew.profiles;assert.equal(profiles.franky.model,'personal:model');assert.equal(profiles.franky.instructions,'My own instructions');assert.equal(profiles.robin.instructions,'');assert.equal(profiles.franky.sessions,sessions);assert.equal(f.hub.state.growth,growth);
 assert.deepEqual(profiles.franky.skills,defaults('franky').skills);assert.deepEqual(profiles.vivi.skills,defaults('vivi').skills);
 assert.deepEqual(initialLocalCrew(f.hub.state.localCrew).profiles.franky.instructions,'My own instructions');
 await assert.rejects(f.council.setup({model:'fixture:local',refreshSkills:'yes'}),/boolean/);
 f.hub.localCrew.save=async()=>{throw Error('Disk full');};await assert.rejects(f.council.setup({model:'fixture:local',refreshSkills:true}),/Disk full/);assert.equal(f.hub.state.localCrew.profiles,profiles);
 f.hub.localCrew.save=async()=>{throw Object.assign(Error('Outcome uncertain'),{uncertain:true});};await assert.rejects(f.council.setup({model:'fixture:local',refreshSkills:true}),/uncertain/);assert.notEqual(f.hub.state.localCrew.profiles,profiles,'uncertain saves are not falsely rolled back');
});
test('Luffy picks real available specialists and synthesizes only their actual reports',async()=>{
 const f=fixture();const result=await f.council.start({projectId:'p',objective:'Fix an input bug.'});
 assert.equal(result.status,'ready');assert.deepEqual(f.calls.map(call=>call.crewId),['luffy','franky','usopp','zoro','luffy']);
 assert.deepEqual(f.calls.map(call=>call.mode),['plan','advice','advice','advice','advice']);
 assert.ok(f.calls[0].prompt.includes('Customer needs and product research'));
 assert.match(f.calls.at(-1).prompt,/Evidence-limited proposal by franky/);
 assert.deepEqual(f.saved().localCrew.councils[0],result);assert.equal(f.council.active,null);
});
test('manual crew selection bypasses routing, with bounded actual overlap',async()=>{
 let working=0,max=0;const f=fixture(async(crewId)=>{if(crewId==='luffy')return {model:'fixture:local',text:'Synthesis.'};working++;max=Math.max(max,working);await new Promise(resolve=>setTimeout(resolve,5));working--;return {model:'fixture:local',text:crewId+' actual result'};});
 const result=await f.council.start({projectId:'p',objective:'Review.',crewIds:['franky','zoro','law'],concurrency:2});
 assert.equal(max,2);assert.equal(result.status,'ready');assert.deepEqual(f.calls.map(call=>call.crewId),['franky','zoro','law','zoro','luffy']);
});
test('failed specialists stay visible and make synthesis partial',async()=>{
 const f=fixture(async id=>{if(id==='zoro')throw Error('Model unavailable');return {model:'fixture:local',text:'Actual '+id};});
 const result=await f.council.start({projectId:'p',objective:'Review.',crewIds:['franky','zoro']});
 assert.equal(result.status,'partial');assert.equal(result.contributions[1].status,'failed');assert.match(f.calls.at(-1).prompt,/Model unavailable/);
});
test('all failed contributions never fabricate a synthesis',async()=>{
 const f=fixture(async()=>{throw Error('Offline');});await assert.rejects(f.council.start({projectId:'p',objective:'Review.',crewIds:['franky']}),/No specialist/);
 assert.equal(f.calls.length,1);assert.equal(f.council.records[0].status,'failed');
});
test('untrusted plans reject unknown, duplicate, unrecruited and reporter assignments',()=>{
 const available=new Set(['franky']);
 for(const assignments of [[{crewId:'morgans',objective:'Report'}],[{crewId:'ace',objective:'Prototype'}],[{crewId:'franky',objective:'a'},{crewId:'franky',objective:'b'}],[]])assert.throws(()=>parsePlan(JSON.stringify({summary:'Plan',assignments}),available));
 assert.throws(()=>parsePlan('{',available),/usable assignment/);
 assert.throws(()=>parsePlan(JSON.stringify({summary:'Plan',assignments:[{crewId:'franky',objective:'a',shell:'bad'}]}),available),/Invalid/);
});
test('invalid caller inputs fail before local requests',async()=>{
 const f=fixture();for(const extra of [{crewIds:['morgans']},{crewIds:['ace']},{crewIds:['franky','franky']},{concurrency:3},{endpoint:'https://example.com'}])await assert.rejects(f.council.start({projectId:'p',objective:'Review',...extra}));assert.equal(f.calls.length,0);
});
test('stop aborts active contributions and prevents queued workers and synthesis',async()=>{
 let release,started;const ready=new Promise(resolve=>started=resolve);
 const f=fixture(async(_id,_prompt,signal)=>{started();await new Promise(resolve=>release=resolve);assert.equal(signal.aborted,true);return {model:'fixture:local',text:'Late reply'};});
 const work=f.council.start({projectId:'p',objective:'Review',crewIds:['franky','zoro']});await ready;
 await f.council.stop({id:f.council.active.record.id});release();assert.equal((await work).status,'interrupted');
 assert.equal(f.calls.length,1);assert.equal(f.council.records[0].status,'interrupted');assert.ok(f.council.records[0].contributions.every(item=>!item.text));
});
test('start persistence gates inference and definite failure restores prior records',async()=>{
 const f=fixture();f.hub.persist=()=>{throw Error('Disk full');};await assert.rejects(f.council.start({projectId:'p',objective:'Review'}),/Disk full/);assert.equal(f.calls.length,0);assert.deepEqual(f.council.records,[]);
});

test('Stop does not hide a failed persistence outcome or shutdown behind a successful result',async()=>{
 for(const mode of ['storage','shutdown']){
  let release,started;const ready=new Promise(resolve=>started=resolve);
  const f=fixture(async()=>{started();await new Promise(resolve=>release=resolve);return {model:'fixture:local',text:'Late reply'};});
  const work=f.council.start({projectId:'p',objective:'Retain my draft',crewIds:['franky']});await ready;
  if(mode==='storage'){f.hub.persist=()=>{throw Object.assign(Error('Disk acknowledgement lost'),{uncertain:true});};await assert.rejects(f.council.stop({id:f.council.active.record.id}),/acknowledgement/);}
  else{f.hub.quiescing=true;f.council.close();}
  release();await assert.rejects(work);assert.equal(f.council.records[0].summary,'');assert.equal(f.council.active,null);
 }
});
test('restart retains bounded reports but interrupts work without replay',()=>{
 const result=initialCouncils([{id:'c',projectId:'p',objective:'Review',status:'working',contributions:[{crewId:'franky',status:'working',text:'',objective:'Fix'},{crewId:'zoro',status:'ready',text:'Observed report',objective:'Review'}],secret:'discard'}]);
 assert.equal(result[0].status,'interrupted');assert.equal(result[0].contributions[0].status,'interrupted');assert.equal(result[0].contributions[1].text,'Observed report');assert.equal(result[0].secret,undefined);
});
test('Morgans receives fixed sanitized statuses, never goal, code, reports or errors',async()=>{
 const f=fixture(async id=>({model:'fixture:local',text:'Actual '+id}));f.hub.state.localCrew.profiles.morgans={model:'fixture:local'};
 const record=await f.council.start({projectId:'p',objective:'PRIVATE_GOAL secret code',crewIds:['franky']});record.summary='PRIVATE_SUMMARY';record.contributions[0].text='PRIVATE_CODE';record.contributions[0].error='PRIVATE_ERROR';
 const report=await f.council.report({id:record.id});assert.equal(report.status,'ready');const call=f.calls.at(-1);assert.equal(call.crewId,'morgans');assert.doesNotMatch(call.prompt,/PRIVATE_/);assert.match(call.prompt,/sanitized-local-council-status-v1/);assert.match(call.prompt,/acceptanceEvaluated":false/);
});
test('execution handoff uses reviewed user text, real goal path and one pending receipt',async()=>{
 const f=fixture();const record=await f.council.start({projectId:'p',objective:'Fix',crewIds:['franky']});f.hub.state.codex={status:'connected'};
 let received;f.hub.startGoal=async input=>{received=input;return {started:true,mission:{id:record.handoff.missionId},run:{id:record.handoff.runId},task:{id:'t'}};};
 const args={id:record.id,title:'Fix utility',objective:'Only this reviewed scope.',acceptanceCriteria:['The regression passes.']};
 const result=await f.council.handoff(args);assert.equal(result.taskId,'t');assert.equal(received.objective,args.objective);assert.equal(received.completionBoundary,'review');assert.equal(received.projectId,'p');
 await assert.rejects(f.council.handoff(args),/already has/);
});
test('failed execution receipt remains unknown and cannot blindly retry',async()=>{
 const f=fixture();const record=await f.council.start({projectId:'p',objective:'Fix',crewIds:['franky']});f.hub.state.codex={status:'connected'};let launches=0;f.hub.startGoal=async()=>{launches++;throw Error('Connection lost after possible launch');};
 const args={id:record.id,title:'Fix',objective:'Reviewed scope',acceptanceCriteria:['Check']};await assert.rejects(f.council.handoff(args),/Connection lost/);assert.equal(record.handoff.status,'unknown');await assert.rejects(f.council.handoff(args),/already has/);assert.equal(launches,1);
});
test('handoff storage failure prevents execution',async()=>{
 const f=fixture();const record=await f.council.start({projectId:'p',objective:'Fix',crewIds:['franky']});f.hub.state.codex={status:'connected'};let launches=0;f.hub.startGoal=async()=>{launches++;};f.hub.persist=()=>{throw Error('Disk full');};
 await assert.rejects(f.council.handoff({id:record.id,title:'Fix',objective:'Reviewed scope',acceptanceCriteria:['Check']}),/Disk full/);assert.equal(launches,0);assert.equal(record.handoff,undefined);
});
test('pending handoffs and reports become uncertain/interrupted on restart',()=>{
 const [record]=initialCouncils([{id:'c',projectId:'p',status:'ready',handoff:{status:'pending'},report:{status:'working',text:''}}]);assert.equal(record.handoff.status,'unknown');assert.equal(record.report.status,'interrupted');
});
test('short conversation is answered by Luffy without fabricated worker activity',async()=>{
 const f=fixture(async()=>({model:'fixture:local',text:JSON.stringify({summary:'Answering directly',assignments:[],reply:'Tell me the project and what a good result looks like.'})}));
 const result=await f.council.start({projectId:'p',objective:'Hello Luffy'});assert.equal(f.calls.length,1);assert.deepEqual(result.contributions,[]);assert.equal(result.status,'ready');assert.match(result.summary,/Tell me the project/);
});
test('cross-review receives actual results before Luffy synthesizes them',async()=>{
 const f=fixture(async(id,prompt)=>{if(id==='zoro'){assert.match(prompt,/ACTUAL_BAD_TEST/);return {model:'fixture:local',text:'The whitespace test contradicts the contract.'};}return {model:'fixture:local',text:id==='franky'?'ACTUAL_BAD_TEST':'Use the corrected contract.'};});
 const result=await f.council.start({projectId:'p',objective:'Review.',crewIds:['franky']});assert.equal(result.review.status,'ready');assert.match(f.calls.at(-1).prompt,/whitespace test contradicts/);
});
test('synthesis budgeting keeps full small reports and preserves the tail of large reports',()=>{
 const {reportContext}=require('../desktop/local-council.cjs');const small={crewId:'franky',model:'fixture:local',status:'ready',error:'',text:'Complete short report.'};assert.equal(reportContext([small]).reports[0].report,small.text);assert.equal(reportContext([small]).limited,false);
 const large={...small,text:'BEGIN '+('long statement\n'.repeat(1800))+' FINAL_CONTRADICTION'};const context=reportContext([large],2000);assert.ok(JSON.stringify(context.reports).length<=2000);assert.match(context.reports[0].report,/BEGIN/);assert.match(context.reports[0].report,/FINAL_CONTRADICTION/);assert.equal(context.limited,true);
});
test('Stop is idempotent and cannot relabel a received council answer during persistence',async()=>{
 const f=fixture();const original=f.hub.persist;let ready,release;const saving=new Promise(resolve=>ready=resolve);f.hub.persist=async()=>{if(f.council.active?.record.status==='ready'){ready();await new Promise(resolve=>release=resolve);}original.call(f.hub);};
 const work=f.council.start({projectId:'p',objective:'Review',crewIds:['franky']});await saving;const id=f.council.active.record.id;await assert.rejects(f.council.stop({id}),/arrived/);f.council.close();release();await work;assert.equal(f.council.records[0].status,'ready');
});
test('unconfigured reviewer is visible as missing evidence, not a successful review',async()=>{
 const f=fixture();delete f.hub.state.localCrew.profiles.zoro;const result=await f.council.start({projectId:'p',objective:'Review',crewIds:['franky']});assert.equal(result.status,'partial');assert.equal(result.review.status,'failed');assert.match(result.review.error,/no cross-review/);
});

test('setup preserves personal profiles, specializes legacy defaults, and rolls back definite failure',async()=>{
 const f=fixture();f.hub.localCrew.assertWritable=()=>{};f.hub.localCrew.models=async()=>[{name:'fixture:local'}];f.hub.localCrew.save=async()=>{};
 f.hub.state.localCrew.profiles.franky.instructions='Personal engineering preferences';f.hub.state.localCrew.profiles.franky.model='personal:model';
 f.hub.state.localCrew.profiles.robin={model:'',skills:['architecture','debugging','review','testing'],instructions:'',sessions:[]};
 await f.council.setup({model:'fixture:local'});
 assert.equal(Object.keys(f.hub.state.localCrew.profiles).length,15);assert.equal(f.hub.state.localCrew.profiles.franky.model,'personal:model');assert.equal(f.hub.state.localCrew.profiles.franky.instructions,'Personal engineering preferences');assert.deepEqual(f.hub.state.localCrew.profiles.robin.skills,defaults('robin').skills);
 const before=f.hub.state.localCrew.profiles;f.hub.localCrew.save=async()=>{throw Error('Disk full');};await assert.rejects(f.council.setup({model:'fixture:local'}),/Disk full/);assert.equal(f.hub.state.localCrew.profiles,before);
});
test('ambiguous saved council IDs cannot dispatch a handoff or reporter',async()=>{
 const f=fixture();const record=await f.council.start({projectId:'p',objective:'Review',crewIds:['franky']});f.council.records.push(structuredClone(record));
 await assert.rejects(f.council.report({id:record.id}),/Ambiguous/);await assert.rejects(f.council.handoff({id:record.id,title:'Fix',objective:'Fix',acceptanceCriteria:['Check']}),/Ambiguous/);
});
test('Luffy can clarify a request before any specialist is configured',async()=>{
 const f=fixture(async()=>({model:'fixture:local',text:JSON.stringify({summary:'Clarify',assignments:[],reply:'What outcome do you want?'})}));
 f.hub.state.localCrew.profiles={luffy:f.hub.state.localCrew.profiles.luffy};const result=await f.council.start({projectId:'p',objective:'Hello'});assert.equal(result.status,'ready');assert.equal(f.calls.length,1);
});
test('stopping Morgans rejects late replies without replacing the council',async()=>{
 let release,started;const ready=new Promise(resolve=>started=resolve);
 const f=fixture(async(id)=>{if(id==='morgans'){started();await new Promise(resolve=>release=resolve);}return {model:'fixture:local',text:'Actual '+id};});
 f.hub.state.localCrew.profiles.morgans={model:'fixture:local'};const record=await f.council.start({projectId:'p',objective:'Review',crewIds:['franky']});
 const work=f.council.report({id:record.id});await ready;await f.council.stopReport({id:record.id});release();await assert.rejects(work);assert.equal(record.report.status,'interrupted');assert.equal(record.report.text,'');assert.equal(record.status,'ready');assert.equal(f.council.reporter,null);
});

test('follow-ups retain only bounded same-project conversation context, without inherited authority',async()=>{
 const f=fixture();const first=await f.council.start({projectId:'p',objective:'Build a lesson picker',crewIds:['franky']});first.summary='Earlier useful recommendation';first.handoff={status:'started',taskId:'private-task-reference'};
 const next=await f.council.start({projectId:'p',objective:'Make that keyboard accessible',parentId:first.id,crewIds:['sanji']});assert.equal(next.parentId,first.id);const call=f.calls.find(c=>c.crewId==='sanji');assert.match(call.prompt,/Earlier useful recommendation/);assert.match(call.prompt,/no permissions inherited/);assert.doesNotMatch(call.prompt,/private-task-reference/);assert.equal(next.handoff,undefined);
 assert.equal(initialCouncils([next])[0].parentId,first.id);
});
test('missing, active and cross-project parents fail before any model call',async()=>{
 const f=fixture();const args={projectId:'p',objective:'Follow up',parentId:'previous'};await assert.rejects(f.council.start(args),/settled previous/);
 f.council.records.push({id:'previous',projectId:'other',status:'ready'});await assert.rejects(f.council.start(args),/settled previous/);f.council.records[0].projectId='p';f.council.records[0].status='working';await assert.rejects(f.council.start(args),/settled previous/);assert.equal(f.calls.length,0);
});
test('large follow-up context stays within the local transport budget and reports shortening',async()=>{
 const f=fixture();const first=await f.council.start({projectId:'p',objective:'Initial',crewIds:['franky']});first.objective='x'.repeat(6000);first.summary='y'.repeat(16000);
 const next=await f.council.start({projectId:'p',objective:'Follow up',parentId:first.id,crewIds:['franky']});assert.equal(next.contextLimited,true);assert.ok(f.calls.every(call=>call.prompt.length<=16000));
});

test('known execution release gate rejects before any handoff receipt or mission',async()=>{const f=fixture();const record=await f.council.start({projectId:'p',objective:'Fix'});f.hub.state.codex={status:'connected'};f.hub.assertSupervisedExecutionAdmission=()=>{throw Error('Execution release gate closed');};let launches=0,saves=0;f.hub.startGoal=()=>{launches++;};f.hub.persist=()=>{saves++;};await assert.rejects(f.council.handoff({id:record.id,title:'Fix',objective:'Reviewed scope',acceptanceCriteria:['Check']}),/release gate closed/);assert.equal(launches,0);assert.equal(saves,0);assert.equal(record.handoff,undefined);});

test('review and synthesis retain the complete captain contract before allocating report context',async()=>{const f=fixture(async()=>({model:'fixture:local',text:'Long proposal '.repeat(1000)}));const objective='x'.repeat(5900)+' END_OF_CONTRACT_MUST_REMAIN';const result=await f.council.start({projectId:'p',objective,crewIds:['franky']});for(const call of f.calls){assert.ok(call.prompt.includes(objective),call.crewId+' retains the full request');assert.ok(call.prompt.length<=16000);}assert.equal(result.synthesisLimited,true);assert.equal(result.status,'ready');});
