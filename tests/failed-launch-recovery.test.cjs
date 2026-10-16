const {receiptStore}=require('./helpers/receipt-store.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {Hub}=require('../desktop/hub.cjs');const {CodexClient}=require('../desktop/codex.cjs');
function setup(t){
 let saved={projects:[{id:'p',path:process.cwd(),name:'Fixture'}]};
 const store={load:()=>structuredClone(saved),save:value=>{saved=structuredClone(value);},close(){}};
 const catalog={discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]};
 let hub=new Hub({home:process.cwd(),store:receiptStore(store),catalog}),calls=[];
 function transport(){hub.client.connected=true;hub.state.codex.status='connected';hub.client.request=async(method,args)=>{calls.push({method,args});if(method==='thread/start')return {thread:{id:'thread-'+calls.length}};if(method==='turn/start')return {turn:{id:'turn-'+calls.length}};return {};};}
 transport();t.after(()=>hub.close());
 return {get hub(){return hub;},store,calls,async fail(error=Object.assign(Error('Not submitted'),{notSubmitted:true})){
  const request=hub.client.request;hub.client.request=async(method,args)=>{if(method==='turn/start')throw error;return request(method,args);};
  await assert.rejects(hub.start({projectId:'p',crewId:'franky',prompt:'Keep this exact goal'}),/Not submitted/);hub.client.request=request;await hub.persist();return hub.state.tasks[0];
 },async restart(){await hub.close();hub=new Hub({home:process.cwd(),store:receiptStore(store),catalog});transport();}};
}
test('disconnected transport proves rejection before any submission',async()=>{
 const client=new CodexClient();await assert.rejects(client.request('turn/start',{}),error=>error.notSubmitted===true&&!error.uncertain);
});
test('explicit failed-launch retry survives restart and deduplicates a lost reply',async t=>{
 const f=setup(t),source=await f.fail();assert.equal(source.launchNotSubmitted,true);await f.restart();
 const command={taskId:source.id,expectedUpdatedAt:source.updatedAt};
 const retried=await f.hub.retryFailedLaunch(command);
 assert.notEqual(retried.id,source.id);assert.equal(retried.recoveryOfTaskId,source.id);assert.equal(retried.messages[0].text,'Keep this exact goal');
 assert.equal(f.hub.task(source.id).retryTaskId,retried.id);assert.equal(f.hub.task(source.id).status,'failed');
 await f.restart();assert.equal((await f.hub.retryFailedLaunch(command)).id,retried.id);
 assert.equal(f.calls.filter(call=>call.method==='turn/start').length,1);assert.equal(f.hub.state.tasks.length,2);
});
test('uncertain and generic failures never gain safe retry evidence',async t=>{
 const f=setup(t),source=await f.fail(Error('Not submitted'));
 assert.notEqual(source.launchNotSubmitted,true);await assert.rejects(f.hub.retryFailedLaunch({taskId:source.id,expectedUpdatedAt:source.updatedAt}),/not submitted|safe|confirmed/i);
});
test('failed retry reservation checkpoint submits no replacement',async t=>{
 const f=setup(t),source=await f.fail();const original=f.store.save;f.store.save=()=>{throw Error('Disk full');};
 await assert.rejects(f.hub.retryFailedLaunch({taskId:source.id,expectedUpdatedAt:source.updatedAt}),/Disk full/);
 assert.equal(f.hub.state.tasks.length,1);assert.equal(source.retryTaskId,undefined);f.store.save=original;
});
test('stale commands and delegated launches cannot bypass their owner',async t=>{
 const f=setup(t),source=await f.fail();await assert.rejects(f.hub.retryFailedLaunch({taskId:source.id,expectedUpdatedAt:source.updatedAt-1}),/changed/);
 source.parentTaskId='captain';await assert.rejects(f.hub.retryFailedLaunch({taskId:source.id,expectedUpdatedAt:source.updatedAt}),/mission|coordinator|owner/i);
});

test('replacement checkpoint failure retains proof that explicit recovery is safe',async t=>{
 const f=setup(t),source=await f.fail(),save=f.store.save;let checkpoints=0;
 f.store.save=value=>{if(++checkpoints===2)throw Error('Replacement disk failure');save(value);};
 const command={taskId:source.id,expectedUpdatedAt:source.updatedAt};
 await assert.rejects(f.hub.retryFailedLaunch(command),/Replacement disk failure/);
 const replacement=await f.hub.retryFailedLaunch(command);
 assert.equal(replacement.launchNotSubmitted,true);assert.equal(replacement.threadId,undefined);
 assert.equal(f.calls.filter(call=>call.method==='turn/start').length,0);
 f.store.save=save;await f.hub.persist();await f.restart();
 const recovered=await f.hub.retryFailedLaunch({taskId:replacement.id,expectedUpdatedAt:replacement.updatedAt});
 assert.equal(recovered.messages[0].text,'Keep this exact goal');
 assert.equal(f.calls.filter(call=>call.method==='turn/start').length,1);
});

test('a rejection before thread creation retains the entire goal across restart',async t=>{
 const f=setup(t);f.hub.client.request=async()=>{throw Object.assign(Error('Transport unavailable before send'),{notSubmitted:true});};
 const prompt='Keep the complete objective beyond the title. '.repeat(20);
 await assert.rejects(f.hub.start({projectId:'p',crewId:'franky',prompt}),/Transport unavailable/);
 const source=f.hub.state.tasks[0];assert.equal(source.launchPrompt,prompt);assert.equal(source.messages.length,0);await f.restart();
 const next=await f.hub.retryFailedLaunch({taskId:source.id,expectedUpdatedAt:source.updatedAt});assert.equal(next.messages[0].text,prompt);assert.equal(next.launchPrompt,undefined);
});

test('an uncertain replacement never submits again when the retry reply is lost',async t=>{
 const f=setup(t),source=await f.fail(),request=f.hub.client.request;let submitted=0;
 f.hub.client.request=async(method,args)=>{if(method==='turn/start'){submitted++;throw Object.assign(Error('Connection lost after send'),{uncertain:true});}if(method==='thread/read')throw Error('Offline');return request(method,args);};
 const command={taskId:source.id,expectedUpdatedAt:source.updatedAt};await assert.rejects(f.hub.retryFailedLaunch(command),/Connection lost/);
 const next=await f.hub.retryFailedLaunch(command);assert.equal(next.status,'unknown');assert.equal(submitted,1);assert.equal(f.hub.gate.active.has(next.id),true);
 await assert.rejects(f.hub.send(source.id,'Try again'),/Retry failed launch/);
});

test('uncertain errors remain ineligible even if another error flag says not submitted',async t=>{
 const f=setup(t),source=await f.fail(Object.assign(Error('Not submitted'),{notSubmitted:true,uncertain:true}));
 assert.notEqual(source.launchNotSubmitted,true);await assert.rejects(f.hub.retryFailedLaunch({taskId:source.id,expectedUpdatedAt:source.updatedAt}),/not confirmed/);
});

test('failed report creation returns its task identity for linked reporter recovery',async t=>{
 const f=setup(t),request=f.hub.client.request;
 f.hub.client.request=async(method,args)=>{if(method==='config/read')return {config:{}};if(method==='turn/start')throw Object.assign(Error('Report not submitted'),{notSubmitted:true});return request(method,args);};
 const result=await f.hub.createWorkReport({projectIds:['p']});
 assert.match(result.error,/Report not submitted/);assert.equal(result.task.launchNotSubmitted,true);
 f.hub.client.request=async(method,args)=>method==='config/read'?{config:{}}:request(method,args);
 const recovered=await f.hub.retryFailedLaunch({taskId:result.task.id,expectedUpdatedAt:result.task.updatedAt});
 const {resolveReportTask}=require('../src/reportTask.ts');
 assert.equal(resolveReportTask(f.hub.state.tasks,result.task).id,recovered.id);
 assert.equal(recovered.messages[0].text,result.task.messages[0].text);
});
