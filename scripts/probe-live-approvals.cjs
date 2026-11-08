// Explicit opt-in, real-provider probe. Only the generated fixture action may be approved.
// Never run in CI; receipts omit provider text, commands, credentials and account details.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createHash,randomUUID}=require('node:crypto');
const {Hub}=require('../desktop/hub.cjs');
const {openOrderedStore}=require('../desktop/ordered-store.cjs');
const {findCodex}=require('../desktop/codex.cjs');
const sha=value=>createHash('sha256').update(value).digest('hex');
const action="require('node:fs').appendFileSync(require('node:path').join(__dirname,'effects.txt'),'x');\n";
const command='node fixture-action.cjs';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label,ms=90000){const end=Date.now()+ms;while(Date.now()<end){if(check())return;await delay(100);}throw Error('Timed out: '+label);}
function validCommand(approval,root){
 const p=approval.params,suffix=[' -Command "'+command+'"'," -Command '"+command+"'"].find(s=>p.command?.endsWith(s));
 if(approval.method!=='item/commandExecution/requestApproval'||p.cwd!==root||typeof p.command!=='string'||!suffix)return false;
 const shell=p.command.slice(0,-suffix.length);if(!/^"[^"\r\n]+\\pwsh\.exe"$/i.test(shell))return false;
 const executable=shell.slice(1,-1).replaceAll('\\\\','\\');
 if(!path.isAbsolute(executable)||!fs.existsSync(executable))return false;
 const shells=(process.env.PATH||'').split(path.delimiter).map(dir=>path.join(dir,'pwsh.exe')).filter(file=>fs.existsSync(file)).map(file=>fs.realpathSync.native(file).toLowerCase());
 if(!shells.includes(fs.realpathSync.native(executable).toLowerCase()))return false;
 return fs.readFileSync(path.join(root,'fixture-action.cjs'),'utf8')===action&&JSON.stringify(p.commandActions)===JSON.stringify([{type:'unknown',command}]);
}
async function probe(output,only){
 if(fs.existsSync(output)&&fs.readdirSync(output).length)throw Error('Use a fresh evidence directory; existing receipts are never overwritten.');
 const report={version:1,startedAt:new Date().toISOString(),source:'real-provider',liveProviderProof:true,pendingReplayVerified:false,passed:false,executionGateOpen:false,cases:[]};
 fs.mkdirSync(output,{recursive:true});const save=()=>fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(report,null,2));
 report.sourceCommit=require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}).trim();
 report.sourceDirty=Boolean(require('node:child_process').execFileSync('git',['status','--porcelain'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}).trim());
 const exe=findCodex(os.homedir());report.cliVersion=require('node:child_process').execFileSync(exe,['--version'],{encoding:'utf8'}).trim();report.cliSha256=sha(fs.readFileSync(exe));save();
 assert.equal(require('../desktop/supervised-runs.cjs').LIVE_SUPERVISION_ADMITTED,false);
 const cases=['accept-duplicate-edited','decline','interrupt-pending','disconnect-pending'];if(only)assert.ok(cases.includes(only));report.completeMatrix=!only;
 for(const name of only?[only]:cases){
  const root=fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()),'sunny-m1-live-')),profile=path.join(output,name),entry={name,events:[],passed:false};report.cases.push(entry);fs.mkdirSync(profile);fs.writeFileSync(path.join(root,'fixture-action.cjs'),action);
  const makeHub=async()=>new Hub({home:os.homedir(),store:await openOrderedStore({kind:'sqlite',file:path.join(profile,'fixture.sqlite'),backupDir:path.join(profile,'backups')}),catalog:{discoverProjects:()=>[{id:'m1-fixture',name:'M1 fixture',path:root}],discoverTools:()=>[],discoverAutomations:()=>[]}});
  let hub=await makeHub(),task={id:randomUUID(),projectId:'m1-fixture',crewId:'franky',title:'M1 '+name,status:'starting',executionId:randomUUID(),createdAt:Date.now(),updatedAt:Date.now(),messages:[]};hub.state.tasks.push(task);hub.reserveWriter(task);
  const responses=[],owned=[];let connection=0;
  const observe=()=>{
  const request=hub.client.request.bind(hub.client);hub.client.request=async(method,params,timeout)=>{const result=await request(method,params,timeout);if(method==='thread/resume')entry.events.push({kind:'resume-policy',connection,approvalPolicy:result.approvalPolicy,approvalsReviewer:result.approvalsReviewer,sandbox:result.sandbox});return result;};
  const send=hub.client.send.bind(hub.client);hub.client.send=m=>{if(m.result)responses.push({connection,rpcId:m.id,result:structuredClone(m.result)});if(['thread/start','thread/resume','thread/read','turn/start','turn/interrupt'].includes(m.method))entry.events.push({kind:'client-request',connection,method:m.method,threadId:m.params?.threadId});return send(m);};
  hub.client.on('request',m=>entry.events.push({kind:'request',connection,rpcId:m.id,method:m.method,threadId:m.params?.threadId,turnId:m.params?.turnId,commandSha256:typeof m.params?.command==='string'?sha(m.params.command):null}));
  hub.client.on('notification',m=>{if(m.method==='serverRequest/resolved')entry.events.push({kind:'resolved',connection,requestId:m.params.requestId,threadId:m.params.threadId});if(m.method==='turn/completed')entry.events.push({kind:'turn-completed',connection,turnId:m.params.turn.id,status:m.params.turn.status});});
  };observe();
  const connect=async()=>{connection++;await hub.client.connect(os.homedir());owned.push(hub.client.child);hub.state.codex.status='connected';};
  const effect=()=>fs.existsSync(path.join(root,'effects.txt'))?fs.readFileSync(path.join(root,'effects.txt'),'utf8'):'';
  try{
   await connect();const models=await hub.client.request('model/list');const model=models.data.find(m=>m.isDefault)?.id;assert.ok(model);entry.model=model;hub.state.models=models.data;task.model=model;task.effort='low';
   const started=await hub.client.request('thread/start',{cwd:root,model,sandbox:'read-only',approvalPolicy:'on-request',approvalsReviewer:'user',baseInstructions:'You are a bounded approval-protocol fixture. Do only the exact single command requested. Do not inspect files, use web/MCP/skills/delegation, or retry a denied command. After denial stop.',config:{web_search:'disabled'}});
   task.threadId=started.thread.id;entry.threadId=task.threadId;entry.approvalPolicy=started.approvalPolicy;entry.sandbox=started.sandbox;hub.loaded.add(task.id);await hub.taskDurable(task,'dispatch');
   const prompt='Invoke the shell tool exactly once with command: '+command+'. Use sandbox_permissions require_escalated and justification "Sunny M1 harmless fixture approval". This prewritten fixture appends one character only to effects.txt in the isolated cwd. Await approval. If declined, stop without retrying or using another tool. Do not read or change the script.';
   const result=await hub.client.request('turn/start',{threadId:task.threadId,input:[{type:'text',text:prompt}],effort:'low'});task.turnId=result.turn.id;entry.turnId=task.turnId;
   await until(()=>hub.state.approvals.length>0||['finished','failed','interrupted'].includes(task.status),'pending real approval');assert.equal(hub.state.approvals.length,1);const a=hub.state.approvals[0];assert.equal(validCommand(a,root),true,'Only the exact prewritten harmless fixture may be approved');assert.equal(effect(),'');entry.requestId=a.rpcId;entry.approvalId=a.id;entry.commandSha256=sha(a.params.command);
   if(name==='accept-duplicate-edited'){
    await assert.rejects(hub.respond({id:a.id,decision:'accept',answers:{command:'changed-preview'}}),/cannot replace/);assert.equal(responses.length,0);entry.editedResponseRejected=true;
    const results=await Promise.allSettled([hub.respond({id:a.id,decision:'accept'}),hub.respond({id:a.id,decision:'accept'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(responses.length,1);entry.duplicateResponseRejected=true;
    await until(()=>['finished','failed','interrupted'].includes(task.status),'accepted turn completion');assert.equal(effect(),'x');
   }else if(name==='decline'){
    await hub.respond({id:a.id,decision:'decline'});await until(()=>['finished','failed','interrupted'].includes(task.status),'declined turn completion');assert.equal(effect(),'');
   }else if(name==='interrupt-pending'){
    await hub.interrupt(task.id);await assert.rejects(hub.respond({id:a.id,decision:'accept'}),/no longer pending/);await until(()=>entry.events.some(e=>e.kind==='turn-completed'),'interrupt completion');assert.equal(effect(),'');assert.equal(responses.length,0);entry.staleResponseRejected=true;
   }else{
    hub.client.disconnect('M1 pending approval transport loss');assert.equal(task.status,'unknown');assert.equal(hub.gate.active.has(task.id),true);assert.equal(hub.state.approvals.length,0);await assert.rejects(hub.respond({id:a.id,decision:'accept'}),/no longer pending/);entry.staleResponseRejected=true;entry.reservationRetained=true;
    const taskId=task.id;await hub.taskDurable(task);await hub.close();hub=await makeHub();task=hub.task(taskId);observe();assert.equal(task.status,'unknown');assert.equal(hub.gate.active.has(task.id),true);assert.equal(hub.state.approvals.length,0);entry.savedHubRestartVerified=true;
    await connect();await hub.checkStatus(task.id);entry.reconciledStatus=task.status;entry.reconciledTurnId=task.turnId;await delay(15000);entry.replayedRequests=entry.events.filter(e=>e.kind==='request'&&e.connection===2);assert.equal(responses.length,0);assert.equal(effect(),'');
    entry.observationSeconds=15;assert.equal(entry.events.some(e=>e.kind==='client-request'&&e.connection===2&&['thread/resume','turn/start'].includes(e.method)),false);entry.noAutomaticRetry=true;
    assert.equal(task.status,'interrupted','Reconcile terminal state before an explicit new turn');assert.equal(hub.gate.active.has(task.id),false);
    entry.events.push({kind:'explicit-new-turn',connection});await hub.send(task.id,'The previous turn was interrupted and has now been reconciled. This is a NEW explicit captain request for a fresh fixture attempt, not an automatic retry. Request fresh approval for this new turn. '+prompt);await until(()=>hub.state.approvals.length>0||['finished','failed','interrupted'].includes(task.status),'fresh approval after reconnect');assert.equal(hub.state.approvals.length,1,'The new explicit turn must actually request approval');const fresh=hub.state.approvals[0];assert.equal(validCommand(fresh,root),true);assert.notEqual(fresh.id,a.id);assert.notEqual(fresh.turnId,a.turnId);await assert.rejects(hub.respond({id:a.id,decision:'accept'}),/no longer pending/);assert.equal(responses.length,0);
    entry.freshApproval={id:fresh.id,rpcId:fresh.rpcId,turnId:fresh.turnId,commandSha256:sha(fresh.params.command)};await hub.respond({id:fresh.id,decision:'accept'});await assert.rejects(hub.respond({id:fresh.id,decision:'accept'}),/no longer pending/);await until(()=>['finished','failed','interrupted'].includes(task.status),'fresh approved completion');assert.equal(effect(),'x');assert.equal(responses.length,1);entry.freshExplicitDecisionVerified=true;
   }
   entry.effectCount=effect().length;entry.responses=responses;entry.taskStatus=task.status;entry.passed=true;
  }catch(error){entry.error=error.message;throw error;}
  finally{
   try{if(hub.client.connected&&task.threadId&&task.turnId&&!['finished','interrupted','failed'].includes(task.status)){await hub.client.request('turn/interrupt',{threadId:task.threadId,turnId:task.turnId},10000);entry.cleanupInterrupt='acknowledged';}}catch{entry.cleanupInterrupt='unconfirmed';}
   await hub.close();await until(()=>owned.every(child=>child.exitCode!==null||child.signalCode!==null),'owned provider exits',10000);entry.ownedProcessesExited=true;entry.finalEffectCount=effect().length;save();console.log(JSON.stringify({case:name,passed:entry.passed,status:entry.taskStatus,replayedRequests:entry.replayedRequests?.length,effectCount:entry.finalEffectCount}));
  }
 }
 report.passed=report.cases.every(c=>c.passed);report.completedAt=new Date().toISOString();save();return report;
}
if(require.main===module){if(process.argv[2]!=='--allow-fixture-actions'||!process.argv[3])throw Error('Usage: node scripts/probe-live-approvals.cjs --allow-fixture-actions <output-directory> [case-name]');probe(path.resolve(process.argv[3]),process.argv[4]).catch(error=>{console.error(error.message);process.exitCode=1;});}
module.exports={validCommand};
