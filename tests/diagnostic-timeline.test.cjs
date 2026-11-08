const {test}=require('node:test'),assert=require('node:assert/strict');
const {timeline,observe,ref,MAX_OBSERVATIONS}=require('../desktop/diagnostic-timeline.cjs');
const {Hub}=require('../desktop/hub.cjs'),{receiptStore}=require('./helpers/receipt-store.cjs');
const secret='PRIVATE-PROMPT-token-password-C:\\private\\workspace';
function state(){return {projects:[{id:'p',name:secret,path:secret},{id:'other'}],tasks:[{id:'t',projectId:'p',executionId:'e',threadId:'thread',turnId:'turn',status:'unknown',title:secret,error:secret,updatedAt:10,messages:[{id:'reply',role:'assistant',text:secret,time:8}]}],missions:[],approvals:[]};}
test('diagnostic projection and export never include free text or sensitive paths',()=>{
 const s=state(),t=s.tasks[0];observe(t,'command-completed','item',{itemId:'item',outcome:'completed',exitCode:0,now:5});t.diagnosticObservations[0].prompt=secret;t.diagnosticObservations[0].command=secret;
 t.approvalResponseIntent={id:'intent',approvalId:'a',executionId:'e',decision:'accept',result:{answers:secret},state:'submitted',submittedAt:3};
 s.missions=[{id:'m',projectId:'p',taskIds:['t'],attempts:[{id:'attempt',taskIds:['t']}],events:[{id:'event',time:4,type:secret,detail:secret,attemptId:'attempt'}],selectedResult:{id:'result',attemptId:'attempt',producerTaskId:'t',ref:{filePath:secret},selectedAt:9}}];
 const out=timeline(s,{projectId:'p'},{now:11,persistence:'saved'}),json=JSON.stringify(out);assert.ok(!json.includes(secret));assert.ok(!json.includes('filePath'));assert.equal(out.entries.find(e=>e.kind==='command-completed').exitCode,0);assert.equal(out.entries.find(e=>e.kind==='command-completed').attemptRef,ref('attempt'));assert.match(out.coverage,/not captain acceptance/);assert.equal(out.entries.find(e=>e.kind==='result-selected').sourceRef,ref('result'));
});
test('diagnostic scope rejects forged project, task, mission, raw detail and oversized limits',()=>{
 const s=state();s.tasks.push({id:'foreign',projectId:'other'});s.missions=[{id:'m',projectId:'other',taskIds:[]}];
 for(const args of [null,[],{}, {projectId:'absent'},{projectId:'p',taskId:'foreign'},{projectId:'p',missionId:'m'},{projectId:'p',includePrivate:true},{projectId:'p',limit:201},{projectId:'p',limit:0}])assert.throws(()=>timeline(s,args));
});
test('observation retention, deduplication and malformed diagnostics cannot manufacture success',()=>{
 const s=state(),t=s.tasks[0];t.diagnosticObservations={invalid:true};observe(t,'approval-requested','a',{requestId:'a',now:1});observe(t,'approval-requested','a',{requestId:'a',now:2});assert.equal(t.diagnosticObservations.length,1);
 for(let i=0;i<140;i++)observe(t,'command-completed','item'+i,{itemId:'item'+i,outcome:secret,now:i});assert.equal(t.diagnosticObservations.length,MAX_OBSERVATIONS);assert.equal(t.diagnosticDropped,13);
 t.diagnosticObservations.push({version:99,id:secret,kind:secret});const out=timeline(s,{projectId:'p',limit:5});assert.equal(out.entries.length,5);assert.equal(out.truncated,true);assert.equal(out.droppedObservations,13);assert.ok(!JSON.stringify(out).includes(secret));assert.ok(out.entries.every(e=>e.outcome==='unknown'));assert.equal(t.status,'unknown');
 const frozen=Object.freeze({diagnosticObservations:[]});assert.equal(observe(frozen,'command-started','id'),false);assert.deepEqual(frozen.diagnosticObservations,[]);
});
test('unknown times and ambiguous attempts remain explicitly unknown',()=>{
 const s=state();delete s.tasks[0].updatedAt;s.missions=[{id:'m',projectId:'p',taskIds:['t'],events:[],attempts:[{id:'old',taskIds:['t']},{id:'new',taskIds:['t']}]}];const e=timeline(s,{projectId:'p'}).entries.find(e=>e.kind==='task-state');assert.equal(e.time,null);assert.equal(e.attemptRef,null);assert.equal(e.missionRef,null);
});
function fixture(t,saved={}){
 let stored=saved;const hub=new Hub({home:process.cwd(),store:receiptStore({load:()=>stored,save:image=>{stored=structuredClone(image);},close:()=>{}}),catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});t.after(()=>hub.close());return {hub,saved:()=>stored};
}
test('Hub M1 journey retains redacted requests, one decision, uncertainty and reconciliation across restart',async t=>{
 const f=fixture(t),hub=f.hub,task={...state().tasks[0],status:'working',crewId:'franky',messages:[]};hub.state.tasks.push(task);hub.client.connected=true;const wire=[];hub.client.respond=(id,result)=>wire.push({id,result});
 const request={id:1,method:'item/commandExecution/requestApproval',params:{threadId:'thread',turnId:'turn',command:secret,cwd:secret}};hub.request(request);hub.request(request);
 await assert.rejects(hub.respond({id:hub.state.approvals[0].id,decision:'accept',answers:{command:secret}}));assert.equal(wire.length,0);
 const a=hub.state.approvals[0];await hub.respond({id:a.id,decision:'accept'});await assert.rejects(hub.respond({id:a.id,decision:'accept'}));assert.equal(wire.length,1);
 await hub.notification({method:'item/completed',params:{threadId:'thread',turnId:'turn',item:{id:'item',type:'commandExecution',status:'completed',command:secret,aggregatedOutput:secret,exitCode:0}}});
 const pending={...request,id:2};hub.request(pending);const old=hub.state.approvals[0].id;hub.client.disconnect(secret);await hub.taskDurable(task);await assert.rejects(hub.respond({id:old,decision:'accept'}));assert.equal(task.status,'unknown');
 const restarted=fixture(t,f.saved()).hub;restarted.ensure=async()=>{};restarted.client.connected=true;restarted.client.request=async method=>{assert.equal(method,'thread/read');return {thread:{status:{type:'idle'},turns:[{id:'turn',status:'interrupted',items:[]}]}};};await restarted.checkStatus('t');
 const report=restarted.diagnosticTimeline({projectId:'p',taskId:'t'}),kinds=report.entries.map(e=>e.kind);for(const kind of ['approval-requested','approval-submitted','command-completed','connection-lost','restart-unknown','reconciled'])assert.ok(kinds.includes(kind),kind);assert.equal(kinds.filter(k=>k==='approval-submitted').length,1);assert.ok(!JSON.stringify(report).includes(secret));assert.equal(restarted.task('t').status,'interrupted');assert.equal(require('../desktop/supervised-runs.cjs').LIVE_SUPERVISION_ADMITTED,false);
});
test('diagnostic read never calls provider and reports unsaved storage without a success claim',async t=>{
 const {hub}=fixture(t);hub.state.tasks.push({...state().tasks[0],crewId:'franky'});hub.client.request=()=>{throw Error('Read must not contact provider');};hub.state.persistence={state:'unsaved',failures:1};const before=structuredClone(hub.state.tasks);const report=hub.diagnosticTimeline({projectId:'p'});assert.equal(report.persistence,'unsaved');assert.deepEqual(hub.state.tasks,before);assert.equal(report.tasksWithoutObservations,1);
});
test('stale provider items are not attributed to the current execution and missing turn stays unknown',async t=>{
 const {hub}=fixture(t),task={...state().tasks[0],crewId:'franky',status:'working',messages:[]};hub.state.tasks.push(task);
 const event=turnId=>({method:'item/completed',params:{threadId:'thread',turnId,item:{id:'old-item',type:'commandExecution',command:secret,status:'completed',exitCode:0}}});
 await hub.notification(event('superseded-turn'));assert.ok(!hub.diagnosticTimeline({projectId:'p'}).entries.some(e=>e.kind==='command-completed'));
 await hub.notification(event(undefined));await hub.notification(event(undefined));const rows=hub.diagnosticTimeline({projectId:'p'}).entries.filter(e=>e.kind==='command-completed');assert.equal(rows.length,1);assert.equal(rows[0].turnRef,null);assert.equal(rows[0].executionRef,null);
});
test('recorded check success is distinct from a captain acceptance receipt',()=>{
 const s=state();s.missions=[{id:'m',projectId:'p',status:'WAITING_FOR_REVIEW',taskIds:[],attempts:[],events:[],artifacts:[{id:'check',kind:'check',attemptId:'a',recordedAt:1,status:'passed',exitCode:0,output:secret,command:secret}]}];
 let out=timeline(s,{projectId:'p',missionId:'m'});assert.equal(out.entries.find(e=>e.kind==='check-recorded').outcome,'passed');assert.ok(!out.entries.some(e=>e.kind==='captain-acceptance'));
 s.missions[0].acceptance={id:'acceptance',actor:'captain',attemptId:'a',acceptedAt:2};out=timeline(s,{projectId:'p',missionId:'m'});assert.equal(out.entries.filter(e=>e.kind==='captain-acceptance').length,1);assert.ok(!JSON.stringify(out).includes(secret));
});
