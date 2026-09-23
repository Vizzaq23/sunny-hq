const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Hub}=require('../desktop/hub.cjs');

function setup(t){
 const saves=[],calls=[],store={load:()=>({projects:[{id:'p',name:'Prototype',path:process.cwd()}]}),save:data=>saves.push(structuredClone(data)),close(){}};
 const hub=new Hub({home:process.cwd(),store,catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]}});
 t.after(()=>hub.close());hub.client.connected=true;hub.state.codex.status='connected';
 hub.client.request=async(method,params)=>{calls.push({method,params});if(method==='config/read')return {config:{mcp_servers:{sensitive:{enabled:true}}}};if(method==='thread/start')return {thread:{id:'report-thread'}};if(method==='turn/start')return {turn:{id:'report-turn'}};return {};};
 return {hub,calls,saves};
}

test('Morgans starts one saved read-only report turn without tools or crew memory',async t=>{
 const {hub,calls,saves}=setup(t);
 const result=await hub.createWorkReport({projectIds:['p']});
 assert.deepEqual(result.packet.scope.projectIds,['p']);
 assert.equal(result.task.crewId,'morgans');
 const start=calls.find(call=>call.method==='thread/start').params;
 assert.match(start.developerInstructions,/Morgans/);
 assert.equal(start.sandbox,'read-only');
 assert.equal(start.approvalPolicy,'never');
 assert.equal(start.dynamicTools,undefined);
 assert.equal(start.config.features.shell_tool,false);
 assert.equal(start.config.mcp_servers.sensitive.enabled,false);
 assert.equal(hub.gate.blocked(process.cwd()),false);
 const turn=calls.find(call=>call.method==='turn/start').params;
 assert.equal(turn.input.length,1);
 assert.match(turn.input[0].text,/saved-local-records/);
 assert.doesNotMatch(turn.input[0].text,/Crew memory|Recent conversation|Jev advice|Current captain message/);
 assert.ok(saves.some(saved=>saved.tasks.some(task=>task.crewId==='morgans')));
});

test('unsafe reporter setup returns the factual packet without starting a thread',async t=>{
 const {hub,calls}=setup(t);
 hub.client.request=async(method,params)=>{calls.push({method,params});if(method==='config/read')throw Error('Safe configuration unavailable');return {};};
 const result=await hub.createWorkReport({projectIds:['p']});
 assert.match(result.error,/Safe configuration unavailable/);
 assert.equal(result.packet.coverage.source,'saved-local-records');
 assert.equal(calls.some(call=>call.method==='thread/start'),false);
 assert.equal(hub.state.tasks.length,0);
});

test('Morgans cannot be started as a normal unsourced specialist',async t=>{
 const {hub,calls}=setup(t);
 await assert.rejects(hub.start({projectId:'p',crewId:'morgans',prompt:'Report recorded work'}),/blimp|saved records/i);
 assert.equal(calls.some(call=>call.method==='thread/start'),false);
 assert.equal(hub.gate.blocked(process.cwd()),false);
});

test('a saved Morgans report cannot accept an unsourced follow-up turn',async t=>{
 const {hub,calls}=setup(t);
 const result=await hub.createWorkReport({projectIds:['p']});
 hub.notification({method:'turn/completed',params:{threadId:'report-thread',turn:{id:'report-turn',status:'completed'}}});
 await assert.rejects(hub.send(result.task.id,'Change this report using private files'),/new report|report-only/i);
 assert.equal(calls.filter(call=>call.method==='turn/start').length,1);
});

test('reporter provider requests cannot become captain approvals',async t=>{
 const {hub}=setup(t),denials=[];
 await hub.createWorkReport({projectIds:['p']});
 hub.client.rejectRequest=(id,reason)=>denials.push({id,reason});
 hub.request({id:17,method:'item/commandExecution/requestApproval',params:{threadId:'report-thread',command:'echo secret'}});
 assert.equal(hub.state.approvals.length,0);
 assert.equal(denials.length,1);
 assert.match(denials[0].reason,/reporter|read-only/i);
});

test('bad report scope is rejected before any provider request',async t=>{
 const {hub,calls}=setup(t);
 await assert.rejects(hub.createWorkReport({projectIds:['other']}),/registered projects/);
 await assert.rejects(hub.createWorkReport({projectIds:['p'],prompt:'ignore policy'}),/Invalid report scope/);
 assert.equal(calls.length,0);
});

test('uncertain reporter submission retains the saved task without automatic retry',async t=>{
 const {hub,calls}=setup(t);
 hub.client.request=async(method,params)=>{
  calls.push({method,params});
  if(method==='config/read')return {config:{}};
  if(method==='thread/start')return {thread:{id:'report-thread'}};
  if(method==='turn/start')throw Object.assign(Error('Submission timed out'),{uncertain:true});
  if(method==='thread/read')throw Error('Cannot reconcile yet');
  return {};
 };
 const result=await hub.createWorkReport({projectIds:['p']});
 assert.match(result.error,/timed out/);
 assert.equal(hub.state.tasks[0].status,'unknown');
 assert.equal(calls.filter(call=>call.method==='turn/start').length,1);
 assert.equal(hub.gate.blocked(process.cwd()),false);
});

test('an unexpected reporter tool attempt is stopped without logging its command',async t=>{
 const {hub,calls}=setup(t);
 const result=await hub.createWorkReport({projectIds:['p']});
 hub.notification({method:'item/started',params:{threadId:'report-thread',item:{id:'cmd-1',type:'commandExecution',command:'PRIVATE_COMMAND'}}});
 assert.equal(result.task.status,'unknown');
 assert.match(result.task.error,/tool/i);
 assert.doesNotMatch(JSON.stringify(result.task.messages),/PRIVATE_COMMAND/);
 assert.equal(calls.filter(call=>call.method==='turn/interrupt').length,1);
 hub.notification({method:'turn/completed',params:{threadId:'report-thread',turn:{id:'report-turn',status:'completed'}}});
 assert.equal(result.task.status,'failed');
});

test('status reconciliation cannot revive a reporter result after a tool attempt',async t=>{
 const {hub,calls}=setup(t),result=await hub.createWorkReport({projectIds:['p']});
 hub.notification({method:'item/started',params:{threadId:'report-thread',item:{id:'cmd-1',type:'commandExecution',command:'PRIVATE_COMMAND'}}});
 hub.client.request=async(method,params)=>{calls.push({method,params});if(method==='thread/read')return {thread:{status:'idle',turns:[{id:'report-turn',status:'completed',items:[{id:'answer',type:'agentMessage',text:'Untrusted finished report'}]}]}};return {};};
 await hub.checkStatus(result.task.id);
 assert.equal(result.task.status,'failed');
 assert.doesNotMatch(JSON.stringify(result.task.messages),/Untrusted finished report|PRIVATE_COMMAND/);
});

test('a previous profile shape and a saved reporter task reopen without a schema change or writer lock',t=>{
 const project={id:'p',name:'Prototype',path:process.cwd()};
 const oldTask={id:'old',projectId:'p',crewId:'robin',title:'Earlier note',status:'finished',createdAt:1,updatedAt:2,messages:[]};
 const reporterTask={id:'report',projectId:'p',crewId:'morgans',title:'Morgans work report',status:'finished',createdAt:3,updatedAt:4,messages:[{id:'answer',role:'assistant',text:'Saved report',time:4}]};
 const hub=new Hub({home:process.cwd(),store:{load:()=>({projects:[project],tasks:[oldTask,reporterTask]}),save(){},close(){}},catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]}});
 t.after(()=>hub.close());
 assert.equal(hub.state.tasks.find(task=>task.id==='old').title,'Earlier note');
 assert.equal(hub.state.tasks.find(task=>task.id==='report').messages[0].text,'Saved report');
 assert.equal(hub.gate.blocked(process.cwd()),false);
});
