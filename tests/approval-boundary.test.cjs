const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Hub}=require('../desktop/hub.cjs');

function fixture(t){
 const hub=new Hub({home:process.cwd(),store:{load:()=>({}),save:()=>{},close:()=>{}},catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});
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
test('nullable elicitation cannot bind to a task without a valid thread',t=>{
 const {hub,task,sent,rejected}=fixture(t);task.status='starting';
 for(const threadId of [undefined,null,'',' ',42,'x'.repeat(201)]){
  task.threadId=threadId;
  hub.request({id:rejected.length+1,method:'mcpServer/elicitation/request',params:{threadId,turnId:null}});
 }
 assert.equal(hub.state.approvals.length,0);assert.equal(sent.length,0);assert.equal(rejected.length,6);
});
test('approval cannot authorize a superseding turn',t=>{
 const {hub,task,sent,request}=fixture(t);request();const a=hub.state.approvals[0];task.turnId='new-turn';
 assert.throws(()=>hub.respond({id:a.id,decision:'accept'}),/no longer|stale|changed/i);assert.equal(sent.length,0);
});
test('reused RPC IDs cannot replay a previously displayed approval',t=>{
 const {hub,sent,request}=fixture(t);request();const old=hub.state.approvals[0];hub.respond({id:old.id,decision:'decline'});
 request();assert.notEqual(hub.state.approvals[0].id,old.id);
 assert.throws(()=>hub.respond({id:old.id,decision:'accept'}),/no longer/i);assert.equal(sent.length,1);
});
test('resolving one of several requests keeps the task waiting',t=>{
 const {hub,task,request}=fixture(t);request(1);request(2);
 hub.respond({id:hub.state.approvals[0].id,decision:'accept'});
 assert.equal(task.status,'waiting');assert.equal(hub.state.approvals.length,1);
 hub.notification({method:'serverRequest/resolved',params:{threadId:'thread',requestId:2}});
 assert.equal(task.status,'working');assert.equal(hub.state.approvals.length,0);
});
test('permission snapshot is detached from mutable provider parameters',t=>{
 const {hub,sent}=fixture(t);const permissions={network:{enabled:false}};
 hub.request({id:1,method:'item/permissions/requestApproval',params:{threadId:'thread',turnId:'turn',permissions}});
 permissions.network.enabled=true;
 hub.respond({id:hub.state.approvals[0].id,decision:'accept'});
 assert.equal(sent[0].result.permissions.network.enabled,false);
});
test('expired acceptance sends nothing; same live request may still be declined',t=>{
 const {hub,sent,request}=fixture(t);request();const a=hub.state.approvals[0];
 const realNow=Date.now;Date.now=()=>realNow()+31*60*1000;
 try{assert.throws(()=>hub.respond({id:a.id,decision:'accept'}),/expired/i);assert.equal(sent.length,0);hub.respond({id:a.id,decision:'decline'});}finally{Date.now=realNow;}
 assert.equal(sent[0].result.decision,'decline');
});
test('declining user input does not submit the filled answers',t=>{
 const {hub,sent}=fixture(t);
 hub.request({id:1,method:'item/tool/requestUserInput',params:{threadId:'thread',turnId:'turn',questions:[{id:'q',question:'Proceed?'}]}});
 hub.respond({id:hub.state.approvals[0].id,decision:'decline',answers:{q:'yes'}});
 assert.deepEqual(sent[0].result,{answers:{}});
});
test('unknown question and invalid decision reject before provider output',t=>{
 const {hub,sent}=fixture(t);
 hub.request({id:1,method:'item/tool/requestUserInput',params:{threadId:'thread',turnId:'turn',questions:[{id:'q'}]}});
 const id=hub.state.approvals[0].id;
 assert.throws(()=>hub.respond({id,decision:'accept',answers:{injected:'yes'}}),/question/i);
 assert.throws(()=>hub.respond({id,decision:'acceptForSession'}),/allow or decline/i);assert.equal(sent.length,0);
});
test('active status notifications cannot hide a pending approval',t=>{
 const {hub,task,request}=fixture(t);request();
 hub.notification({method:'thread/status/changed',params:{threadId:'thread',status:{type:'active',activeFlags:[]}}});
 assert.equal(task.status,'waiting');
});
test('approval received before start acknowledgement binds to the eventual turn',t=>{
 const {hub,task,sent,request}=fixture(t);task.turnId=undefined;request();
 assert.throws(()=>hub.respond({id:hub.state.approvals[0].id,decision:'accept'}),/no longer/);
 hub.notification({method:'turn/started',params:{threadId:'thread',turn:{id:'turn'}}});
 hub.respond({id:hub.state.approvals[0].id,decision:'accept'});assert.equal(sent.length,1);
});
test('changed project and completed task both invalidate approval',t=>{
 const {hub,task,sent,request}=fixture(t);request();const id=hub.state.approvals[0].id;
 task.projectId='other';assert.throws(()=>hub.respond({id,decision:'accept'}),/no longer/);
 task.projectId='p';task.status='finished';assert.throws(()=>hub.respond({id,decision:'accept'}),/no longer/);assert.equal(sent.length,0);
});
test('command approvals require a provider turn identifier',t=>{
 const {hub,task,rejected,request}=fixture(t);task.turnId=undefined;
 for(const turnId of [undefined,null,'',42,{}])request(rejected.length+1,{turnId});
 assert.equal(hub.state.approvals.length,0);assert.equal(rejected.length,5);
});
test('nullable MCP elicitation stays bound to its local execution across acknowledgement',t=>{
 const {hub,task,sent}=fixture(t);task.turnId=undefined;task.executionId='execution';
 hub.request({id:1,method:'mcpServer/elicitation/request',params:{threadId:'thread',turnId:null}});
 const id=hub.state.approvals[0].id;
 hub.notification({method:'turn/started',params:{threadId:'thread',turn:{id:'turn'}}});
 hub.respond({id,decision:'decline'});assert.equal(sent.length,1);
});
test('foreign thread resolution cannot remove a captain request',t=>{
 const {hub,request}=fixture(t);request();
 hub.notification({method:'serverRequest/resolved',params:{threadId:'foreign',requestId:1}});
 assert.equal(hub.state.approvals.length,1);
});
