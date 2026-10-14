// Explicit opt-in; real installed Codex, synthetic local projects, no remote actions.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {Hub}=require('./hub.cjs');const {StateStore,hash}=require('./core.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(hub,condition,label,timeout=120000){
 const end=Date.now()+timeout;
 while(!condition()){
  if(hub.state.approvals.length)throw Error('Live probe requires human approval; no approval was granted.');
  if(Date.now()>end)throw Error('Timed out: '+label);
  await pause(150);
 }
}
async function main(){
 if(process.env.SUNNY_RUN_LIVE_RECOVERY!=='1')throw Error('Set SUNNY_RUN_LIVE_RECOVERY=1 to run the live recovery probe using existing account quota.');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-live-recovery-'));
 const crashWorker=process.env.SUNNY_RECOVERY_CRASH_WORKER==='1';
 const evidence={startedAt:new Date().toISOString(),provider:'installed Codex app-server',interruption:crashWorker?'abrupt provider process exit':'explicit worker interrupt',scope:'synthetic isolated local projects',root,trials:[],passed:false};
 const record=()=>fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({stage:'created',root}));record();
 for(let trial=1;trial<=3;trial++){
  const runtime=path.join(root,'trial-'+trial),project=path.join(runtime,'project'),vault=path.join(runtime,'vault');fs.mkdirSync(project,{recursive:true});fs.mkdirSync(vault);
  execFileSync('git',['init'],{cwd:project,windowsHide:true,stdio:'pipe'});
  fs.writeFileSync(path.join(project,'AGENTS.md'),'Isolated Sunny recovery test. Only checkpoint.txt and report.md may change. Do not access other folders, web, MCP tools, credentials or remote services. Do not create commits or spawn background work. Follow the exact bounded task.\n');
  const stateFile=path.join(runtime,'state.json');
  const catalog={discoverProjects:()=>[{id:'recovery',name:'Isolated recovery',path:project,category:'development'}],discoverTools:()=>[],discoverAutomations:()=>[],vaultPath:()=>vault};
  const open=()=>new Hub({home:os.homedir(),store:new StateStore(stateFile),catalog});
  let hub=open(),task,stage='connect';
  const result={trial,steps:[],passed:false};evidence.trials.push(result);
  const step=(name,extra={})=>{stage=name;result.lastSuccessfulStep=name;result.steps.push({name,time:new Date().toISOString(),...extra});record();console.log(JSON.stringify({trial,stage:name,...extra}));};
  try{
   await hub.connect();assert.equal(hub.state.codex.status,'connected');step('connected');
   const marker=`READY-${trial}`;
   task=await hub.start({projectId:'recovery',crewId:'franky',title:'Interrupted project-status report',prompt:`Create checkpoint.txt containing exactly ${marker}. Then run a foreground wait for 30 seconds. Only after that wait, write report.md containing a short project-status report referencing the checkpoint. Use local tools only, keep the wait in the foreground, and do not alter checkpoint.txt after creating it. This deliberate wait lets the captain interrupt a real in-progress step.`});
   result.interruptedTaskId=task.id;result.model=task.model;step('worker-started',{taskId:task.id});
   await until(hub,()=>fs.existsSync(path.join(project,'checkpoint.txt')),'worker checkpoint');
   assert.equal(task.status,'working','Worker must still be active at interruption');
   const checkpoint=fs.readFileSync(path.join(project,'checkpoint.txt'),'utf8');assert.equal(checkpoint.trim(),marker);const checkpointHash=hash(checkpoint);
   step('checkpoint-written',{taskId:task.id,checkpointHash});
   if(crashWorker){
    const providerProcess=hub.client.child;assert.ok(providerProcess?.pid);providerProcess.kill();
    await until(hub,()=>hub.state.codex.status==='disconnected','provider process exit',15000);
    assert.equal(task.status,'unknown');hub.persist();step('provider-crashed',{taskId:task.id,status:task.status,error:task.error,providerPid:providerProcess.pid});
   }else{await hub.interrupt(task.id);assert.equal(task.status,'interrupted');hub.persist();step('worker-interrupted',{taskId:task.id,status:task.status});}
   const taskId=task.id,threadId=task.threadId;hub.close();hub=open();task=hub.task(taskId);
   assert.equal(task.messages.filter(message=>message.role==='user').length,1);assert.equal(hash(fs.readFileSync(path.join(project,'checkpoint.txt'))),checkpointHash);
   await hub.checkStatus(task.id);
   if(crashWorker&&['working','waiting'].includes(task.status)){await hub.interrupt(task.id);step('recovered-active-turn-interrupted',{taskId:task.id,status:task.status});}
   assert.ok(['interrupted','failed','finished'].includes(task.status),'Restart must resolve uncertainty before a new submission');step('restart-reconciled',{taskId:task.id,status:task.status});
   await hub.send(task.id,`Continue this same task after the captain's interruption. Read checkpoint.txt without modifying it. Do not repeat the wait. Write report.md with a heading Project status, the exact checkpoint value ${marker}, and Status: recovered. Then report completion. Only report.md may change.`);
   await until(hub,()=>['finished','failed','interrupted'].includes(task.status),'resumed report');assert.equal(task.status,'finished',task.error);
   assert.equal(task.threadId,threadId);assert.equal(hash(fs.readFileSync(path.join(project,'checkpoint.txt'))),checkpointHash);
   const report=fs.readFileSync(path.join(project,'report.md'),'utf8');assert.match(report,/Project status/i);assert.ok(report.includes(marker));assert.match(report,/recovered/i);
   assert.equal(hub.state.tasks.length,1);assert.equal(hub.state.approvals.length,0);assert.equal(hub.gate.active.size,0);
   step('same-task-recovered',{taskId:task.id,reportHash:hash(report),duplicateTasks:0,approvals:0});
   const message=task.messages.findLast(item=>item.role==='assistant');
   const saved=hub.resultSaves.save({taskId:task.id,messageId:message.id,title:'Live recovery report '+trial,text:report,reviewed:true});
   hub.close();hub=open();task=hub.task(taskId);assert.equal(hub.resultSaves.recover({saveId:saved.id}).status,'saved');assert.equal(fs.readdirSync(path.join(vault,'00 Inbox')).length,1);
   step('reviewed-save-survived-restart',{taskId:taskId,saveId:saved.id,notePath:saved.path});
   await hub.ensure();const request=hub.client.request.bind(hub.client);let failed=false;
   hub.client.request=async(method,args,timeout)=>{if(method==='turn/start'&&!failed){failed=true;throw Object.assign(Error('Injected pre-submit request failure'),{notSubmitted:true});}return request(method,args,timeout);};
   try{await hub.start({projectId:'recovery',crewId:'robin',title:'Failed request recovery',prompt:`Reply with exactly RECOVERED-${trial}. Do not use tools or change files.`});assert.fail('Expected injected failure');}
   catch(error){assert.match(error.message,/Injected pre-submit request failure/);}
   const failedTask=hub.state.tasks.find(item=>item.id!==taskId);assert.ok(failedTask);assert.equal(failedTask.status,'failed');assert.match(failedTask.error,/Injected/);hub.persist();
   result.failedRequestTaskId=failedTask.id;step('request-failure-visible',{taskId:failedTask.id,error:failedTask.error,status:failedTask.status});
   hub.close();hub=open();task=hub.task(failedTask.id);assert.equal(task.status,'failed');assert.equal(task.messages.filter(message=>message.role==='user').length,1);
   const sourceTask=task;task=await hub.retryFailedLaunch({taskId:sourceTask.id,expectedUpdatedAt:sourceTask.updatedAt});
   assert.equal(task.recoveryOfTaskId,sourceTask.id);assert.equal((await hub.retryFailedLaunch({taskId:sourceTask.id,expectedUpdatedAt:sourceTask.updatedAt})).id,task.id);
   await until(hub,()=>['finished','failed','interrupted'].includes(task.status),'failed request recovery');assert.equal(task.status,'finished',task.error);
   assert.ok(task.messages.findLast(item=>item.role==='assistant')?.text.includes(`RECOVERED-${trial}`));
   assert.equal(hub.state.tasks.length,3);assert.equal(hub.state.approvals.length,0);assert.equal(hub.gate.active.size,0);
   step('failed-request-recovered',{taskId:task.id,duplicateTasks:0,approvals:0});result.passed=true;record();
  }catch(error){result.failure={stage,taskId:task?.id,error:error.message};record();throw error;}
  finally{
   for(const active of hub.state.tasks.filter(item=>['working','starting','waiting','unknown'].includes(item.status)))await hub.interrupt(active.id).catch(error=>{result.cleanupError=error.message;record();});
   hub.close();
  }
 }
 evidence.passed=true;evidence.finishedAt=new Date().toISOString();record();console.log('SUNNY_LIVE_RECOVERY '+JSON.stringify(evidence));return evidence;
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={main};
