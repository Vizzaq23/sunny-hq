const {receiptStore}=require('./helpers/receipt-store.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Hub}=require('../desktop/hub.cjs');

function fixture(t){
 const hub=new Hub({home:process.cwd(),store:receiptStore({load:()=>({}),save:()=>{},close:()=>{}}),catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 t.after(()=>hub.close());
 const task={id:'task',projectId:'p',crewId:'franky',threadId:'thread',turnId:'turn',status:'working',messages:[]};
 hub.state.tasks.push(task);
 const sent=[],rejected=[];
 hub.client.respond=(id,result)=>sent.push({id,result});
 hub.client.rejectRequest=(id,error)=>rejected.push({id,error});
 const request=(id=1,extra={})=>hub.request({id,method:'item/commandExecution/requestApproval',params:{threadId:'thread',turnId:'turn',command:'npm test',...extra}});
 return {hub,task,sent,rejected,request};
}

test('unowned provider approval is rejected without offering authority',t=>{
 const {hub,rejected,request}=fixture(t);request(1,{threadId:'foreign'});
 assert.equal(hub.state.approvals.length,0);assert.equal(rejected.length,1);
});
test('edited command answers cannot approve the unchanged provider command',async t=>{
 const {hub,sent,request}=fixture(t);request();const id=hub.state.approvals[0].id;
 await assert.rejects(hub.respond({id,decision:'accept',answers:{command:'different command'}}),/cannot replace|not supported/i);
 await assert.rejects(hub.respond({id,decision:'accept',command:'different command'}),/Unknown approval response field/);
 assert.deepEqual(sent,[]);assert.equal(hub.state.approvals[0].params.command,'npm test');
 await hub.respond({id,decision:'accept',answers:{}});assert.deepEqual(sent,[{id:1,result:{decision:'accept'}}]);
});
for(const captain of [false,true])test('explicit '+(captain?'captain':'worker')+' continuation reasserts its sandbox and approval boundary',async t=>{
 const {hub,task}=fixture(t),calls=[];task.status='interrupted';hub.ensure=async()=>{};hub.client.connected=true;
 if(captain)Object.assign(task,{crewId:'luffy',captain:true,captainVersion:3});
 hub.client.request=async(method,params)=>{calls.push({method,params});if(method==='config/read')return {config:{}};if(method==='thread/resume')return {thread:{id:task.threadId}};if(method==='turn/start')return {turn:{id:'fresh-turn'}};throw Error('Unexpected fixture call '+method);};
 await hub.send(task.id,'Explicit new fixture turn');const resume=calls.find(c=>c.method==='thread/resume');assert.ok(resume);
 assert.equal(resume.params.sandbox,captain?'read-only':'workspace-write');assert.equal(resume.params.approvalPolicy,captain?'never':'on-request');assert.equal(resume.params.approvalsReviewer,'user');assert.equal(calls.filter(c=>c.method==='turn/start').length,1);
});
test('nullable elicitation cannot bind to a task without a valid thread',t=>{
 const {hub,task,sent,rejected}=fixture(t);task.status='starting';
 for(const threadId of [undefined,null,'',' ',42,'x'.repeat(201)]){
  task.threadId=threadId;
  hub.request({id:rejected.length+1,method:'mcpServer/elicitation/request',params:{threadId,turnId:null}});
 }
 assert.equal(hub.state.approvals.length,0);assert.equal(sent.length,0);assert.equal(rejected.length,6);
});
test('approval cannot authorize a superseding turn',async t=>{
 const {hub,task,sent,request}=fixture(t);request();const a=hub.state.approvals[0];task.turnId='new-turn';
 await assert.rejects(()=>hub.respond({id:a.id,decision:'accept'}),/no longer|stale|changed/i);assert.equal(sent.length,0);
});
test('reused RPC IDs cannot replay a previously displayed approval',async t=>{
 const {hub,sent,request}=fixture(t);request();const old=hub.state.approvals[0];await hub.respond({id:old.id,decision:'decline'});
 request();assert.notEqual(hub.state.approvals[0].id,old.id);
 await assert.rejects(()=>hub.respond({id:old.id,decision:'accept'}),/no longer/i);assert.equal(sent.length,1);
});
test('conflicting duplicate RPC cannot retain approval for a different command',async t=>{
 const {hub,sent,request}=fixture(t);hub.client.connected=true;request();const a=hub.state.approvals[0];
 request();assert.equal(hub.state.approvals.length,1);assert.equal(hub.state.approvals[0],a);
 request(1,{command:'different command'});
 await assert.rejects(hub.respond({id:a.id,decision:'accept'}),/no longer pending|no longer valid/);
 assert.deepEqual(sent,[]);assert.equal(hub.state.codex.status,'disconnected');
});
test('resolving one of several requests keeps the task waiting',async t=>{
 const {hub,task,request}=fixture(t);request(1);request(2);
 await hub.respond({id:hub.state.approvals[0].id,decision:'accept'});
 assert.equal(task.status,'waiting');assert.equal(hub.state.approvals.length,1);
 await hub.notification({method:'serverRequest/resolved',params:{threadId:'thread',requestId:2}});
 assert.equal(task.status,'working');assert.equal(hub.state.approvals.length,0);
});
test('permission snapshot is detached from mutable provider parameters',async t=>{
 const {hub,sent}=fixture(t);const permissions={network:{enabled:false}};
 hub.request({id:1,method:'item/permissions/requestApproval',params:{threadId:'thread',turnId:'turn',permissions}});
 permissions.network.enabled=true;
 await hub.respond({id:hub.state.approvals[0].id,decision:'accept'});
 assert.equal(sent[0].result.permissions.network.enabled,false);
});
test('expired acceptance sends nothing; same live request may still be declined',async t=>{
 const {hub,sent,request}=fixture(t);request();const a=hub.state.approvals[0];
 const realNow=Date.now;Date.now=()=>realNow()+31*60*1000;
 try{await assert.rejects(()=>hub.respond({id:a.id,decision:'accept'}),/expired/i);assert.equal(sent.length,0);await hub.respond({id:a.id,decision:'decline'});}finally{Date.now=realNow;}
 assert.equal(sent[0].result.decision,'decline');
});
test('declining user input does not submit the filled answers',async t=>{
 const {hub,sent}=fixture(t);
 hub.request({id:1,method:'item/tool/requestUserInput',params:{threadId:'thread',turnId:'turn',questions:[{id:'q',question:'Proceed?'}]}});
 await hub.respond({id:hub.state.approvals[0].id,decision:'decline',answers:{q:'yes'}});
 assert.deepEqual(sent[0].result,{answers:{}});
});
test('unknown question and invalid decision reject before provider output',async t=>{
 const {hub,sent}=fixture(t);
 hub.request({id:1,method:'item/tool/requestUserInput',params:{threadId:'thread',turnId:'turn',questions:[{id:'q'}]}});
 const id=hub.state.approvals[0].id;
 await assert.rejects(()=>hub.respond({id,decision:'accept',answers:{injected:'yes'}}),/question/i);
 await assert.rejects(()=>hub.respond({id,decision:'acceptForSession'}),/allow or decline/i);assert.equal(sent.length,0);
});
test('active status notifications cannot hide a pending approval',async t=>{
 const {hub,task,request}=fixture(t);request();
 await hub.notification({method:'thread/status/changed',params:{threadId:'thread',status:{type:'active',activeFlags:[]}}});
 assert.equal(task.status,'waiting');
});
test('approval received before start acknowledgement binds to the eventual turn',async t=>{
 const {hub,task,sent,request}=fixture(t);task.turnId=undefined;request();
 await assert.rejects(()=>hub.respond({id:hub.state.approvals[0].id,decision:'accept'}),/no longer/);
 await hub.notification({method:'turn/started',params:{threadId:'thread',turn:{id:'turn'}}});
 await hub.respond({id:hub.state.approvals[0].id,decision:'accept'});assert.equal(sent.length,1);
});
test('changed project and completed task both invalidate approval',async t=>{
 const {hub,task,sent,request}=fixture(t);request();const id=hub.state.approvals[0].id;
 task.projectId='other';await assert.rejects(()=>hub.respond({id,decision:'accept'}),/no longer/);
 task.projectId='p';task.status='finished';await assert.rejects(()=>hub.respond({id,decision:'accept'}),/no longer/);assert.equal(sent.length,0);
});
test('command approvals require a provider turn identifier',t=>{
 const {hub,task,rejected,request}=fixture(t);task.turnId=undefined;
 for(const turnId of [undefined,null,'',42,{}])request(rejected.length+1,{turnId});
 assert.equal(hub.state.approvals.length,0);assert.equal(rejected.length,5);
});
test('nullable MCP elicitation stays bound to its local execution across acknowledgement',async t=>{
 const {hub,task,sent}=fixture(t);task.turnId=undefined;task.executionId='execution';
 hub.request({id:1,method:'mcpServer/elicitation/request',params:{threadId:'thread',turnId:null}});
 const id=hub.state.approvals[0].id;
 await hub.notification({method:'turn/started',params:{threadId:'thread',turn:{id:'turn'}}});
 await hub.respond({id,decision:'decline'});assert.equal(sent.length,1);
});
test('foreign thread resolution cannot remove a captain request',async t=>{
 const {hub,request}=fixture(t);request();
 await hub.notification({method:'serverRequest/resolved',params:{threadId:'foreign',requestId:1}});
 assert.equal(hub.state.approvals.length,1);
});
test('result acceptance never answers an unrelated provider approval',async t=>{
 const {hub,task,sent,request}=fixture(t);request();const approval=structuredClone(hub.state.approvals[0]);
 const mission=await hub.createMission({projectId:'p',title:'Result review fixture',objective:'Review only this bounded result',acceptanceCriteria:['Review the assistant output']});const attempt=hub.missionBook.begin(mission.id,mission.revision),text='Finished bounded fixture output';
 const producer={id:attempt.taskId,projectId:'p',status:'finished',messages:[{id:'result',role:'assistant',text}]};hub.state.tasks.push(producer);hub.missionBook.sync(hub.state.tasks,hub.state.approvals);
 const sha256=require('node:crypto').createHash('sha256').update(text,'utf8').digest('hex');await hub.selectMissionResult({missionId:mission.id,revision:mission.revision,ref:{kind:'reply',taskId:producer.id,messageId:'result',sha256}});
 await hub.acceptMission({missionId:mission.id,revision:mission.revision,resultId:mission.selectedResult.id,resultSha256:sha256,criteria:[true]});assert.equal(mission.status,'COMPLETE');assert.deepEqual(hub.state.approvals[0],approval);assert.deepEqual(sent,[]);assert.equal(task.status,'waiting');
});
test('offline scheduler dependency cannot unlock the live supervision admission gate',async t=>{const {hub}=fixture(t),{CrewScheduler}=require('../desktop/crew-scheduler.cjs');let starts=0;const errors=[];assert.throws(()=>hub.assertSupervisedExecutionAdmission(),/Supervised execution is disabled/);const run={id:'r',phase:'waiting',grant:{maxWorkers:3,maxRepairs:3},counters:{repairs:0},assignments:[{id:'a',crewId:'franky',ownedPaths:['src'],dependencies:[],state:'queued'}]};const scheduler=new CrewScheduler({getRun:()=>run,capacity:()=>({available:3}),assertLaunch:()=>hub.assertSupervisedExecutionAdmission(),prepare:async()=>{},durableCommit:async mutate=>mutate(run),start:async()=>starts++,onError:error=>errors.push(error)});await scheduler.pump('r');assert.equal(starts,0);assert.equal(run.assignments[0].state,'queued');assert.equal(errors.length,1);assert.match(errors[0].message,/Supervised execution is disabled/);assert.equal(errors[0] instanceof TypeError,false);});


test('reconnect rejects old-transport approval but permits a fresh current-transport replay',async t=>{
 const {hub,task}=fixture(t),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
 const peer=()=>{const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};return child;};
 const old=peer(),current=peer(),writes=[],emit=(child,message)=>child.stdout.write(JSON.stringify(message)+'\n');
 // Use actual CodexClient transport responses rather than the fixture's response interception.
 hub.client.respond=require('../desktop/codex.cjs').CodexClient.prototype.respond;
 const request={id:77,method:'item/commandExecution/requestApproval',params:{threadId:'thread',turnId:'turn',command:'fixture-only-command'}};
 hub.client.attach(old);hub.state.codex.status='connected';emit(old,request);const prior=hub.state.approvals[0];assert.equal(task.status,'waiting');
 hub.client.disconnect('fixture disconnect');assert.equal(task.status,'unknown');assert.equal(hub.state.approvals.length,0);await assert.rejects(hub.respond({id:prior.id,decision:'accept'}),/no longer pending/);
 hub.client.attach(current);hub.state.codex.status='connected';current.stdin.on('data',data=>{const m=JSON.parse(String(data));writes.push(m);if(m.method==='thread/read')emit(current,{id:m.id,result:{thread:{status:{type:'active',activeFlags:['waitingOnApproval']},turns:[{id:'turn',status:'inProgress',items:[]}]}}});});
 await hub.checkStatus(task.id);assert.equal(task.status,'waiting');assert.equal(hub.state.approvals.length,0);
 emit(old,request);assert.equal(hub.state.approvals.length,0);assert.equal(writes.some(m=>m.result),false);
 emit(current,request);const replay=hub.state.approvals[0];assert.notEqual(replay.id,prior.id);await assert.rejects(hub.respond({id:prior.id,decision:'accept'}),/no longer pending/);
 await hub.respond({id:replay.id,decision:'decline'});assert.equal(task.status,'working');assert.equal(hub.state.approvals.length,0);assert.deepEqual(writes.filter(m=>m.result),[{id:77,result:{decision:'decline'}}]);assert.equal(writes.some(m=>m.method==='turn/start'||m.method==='thread/resume'),false);
});
