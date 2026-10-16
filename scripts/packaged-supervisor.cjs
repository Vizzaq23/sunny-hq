// Offline acceptance only. Blocking platform work belongs to the worker, never this deadline loop.
const fs=require('node:fs'),path=require('node:path'),{Worker}=require('node:worker_threads');
function sameOwnedIdentity(expected,actual){
 if(!expected||!actual)return false;
 const keys=['pid','creation','executable','manifest','parentPid','parentCreation','nodeSha256','runner'];
 if(Object.keys(expected).some(key=>!keys.includes(key))||Object.keys(actual).some(key=>!keys.includes(key)))return false;
 for(const key of keys){
  const left=expected[key],right=actual[key];if(['executable','manifest','runner'].includes(key)){if(typeof left==='string'&&typeof right==='string'&&left.toLowerCase()===right.toLowerCase())continue;}
  if(left!==right)return false;
 }
 return Number.isSafeInteger(expected.pid)&&expected.pid>0&&Number.isSafeInteger(expected.parentPid)&&expected.parentPid>0&&/^\d{1,20}$/.test(expected.creation)&&/^\d{1,20}$/.test(expected.parentCreation)&&typeof expected.executable==='string'&&typeof expected.manifest==='string'&&(expected.nodeSha256===undefined&&expected.runner===undefined||/^[a-f0-9]{64}$/.test(expected.nodeSha256)&&typeof expected.runner==='string');
}
function validateCompletion(value,expected){
 const job=value?.job,evidence=value?.evidence;
 if(value?.exitCode!==0||job?.atomic!==true||job.verified!==true||job.timedOut!==false||job.forcedStop!==false||job.cleanupObserved!==true||job.activeProcesses!==0)throw Error('Contained helper or observed cleanup failed');
 if(!evidence||evidence.scenario!==expected.scenario||evidence.exeSha256!==expected.exeSha256||evidence.asarSha256!==expected.asarSha256||evidence.ownedProcessesExited!==true)throw Error('Exact package receipt mismatch');
 const restart=['main-restart','run-ui','playable','journey-cue'].includes(expected.scenario),phases=evidence.phases;
 if(!Array.isArray(phases)||phases.length!==(restart?2:1))throw Error('Phase count mismatch');
 if(!Array.isArray(value.registrations)||value.registrations.length!==phases.length)throw Error('Root registrations missing');
 for(let index=0;index<phases.length;index++){const p=phases[index];if(!Number.isSafeInteger(p.pid)||p.pid<=0||p.phase!==index+1||p.scenario!==expected.scenario||p.executableSha256!==expected.exeSha256||p.asarSha256!==expected.asarSha256||p.providerEffects!==0)throw Error('Exact phase identity or provider effect mismatch');if(p.pid!==p.ownedRoot?.pid||!sameOwnedIdentity(value.registrations[index],p.ownedRoot))throw Error('Root generation or manifest mismatch');}
 if(expected.scenario.startsWith('journey-')){const receipts=require('../desktop/journey-receipts.cjs');for(const p of phases){receipts.validatePhase(p,{scenario:expected.scenario,phase:p.phase});require('node:assert/strict').deepEqual(p.entryHashes,expected.entryHashes);}if(restart){const assert=require('node:assert/strict');assert.deepEqual(phases[1].journey.identity,phases[0].journey.identity);assert.equal(phases[1].admissionSha256,phases[0].admissionSha256);}}
 if(expected.scenario==='ordered-control')require('../desktop/control-receipts.cjs').validatePhase(phases[0],{mib:expected.mib,packageProof:expected.packageProof,resultBytes:Buffer.from(value.controlArtifacts.resultBytes),eventBytes:Buffer.from(value.controlArtifacts.eventBytes),ownedRoot:value.registrations[0]});
 if(restart&&(!evidence.mainProcessRestart||phases[0].pid===phases[1].pid))throw Error('Distinct restart proof missing');
 return true;
}
function supervise(adapter,{timeoutMs,cleanupMs=5000,intervalMs=2000}){
 return new Promise(resolve=>{
  const started=performance.now();let terminal=false,lastStage='armed',poll,inFlight=false;
  const deadline=setTimeout(()=>void finish('timeout'),timeoutMs);
  async function finish(status,value){
   if(terminal)return;terminal=true;clearTimeout(deadline);clearInterval(poll);
   let cleanup='unresolved',cleanupTimer;
   try{const report=await Promise.race([Promise.resolve().then(()=>adapter.close()),new Promise(resolve=>{cleanupTimer=setTimeout(()=>resolve(null),cleanupMs);})]);if(report?.cleanupObserved===true&&report.activeProcesses===0)cleanup='observed';}catch{}finally{clearTimeout(cleanupTimer);}
   if(status==='completed'&&performance.now()-started>=timeoutMs)status='timeout';
   const accepted=status==='completed'&&cleanup==='observed';
   resolve(Object.freeze({version:1,status:accepted?'completed':status==='completed'?'failed':status,accepted,cleanup,lastStage,elapsedMs:Math.round(performance.now()-started),...(accepted?{scenario:value.evidence.scenario}:{})}));
  }
  async function inspect(){if(terminal||inFlight)return;inFlight=true;try{const state=await adapter.inspect();if(!terminal&&typeof state?.stage==='string'&&/^[a-z-]{1,40}$/.test(state.stage))lastStage=state.stage;}catch{}finally{inFlight=false;}}
  // Deliberately schedule after arming the external deadline.
  Promise.resolve().then(()=>adapter.start()).then(async handle=>{if(terminal)return;lastStage='launcher-started';poll=setInterval(()=>void inspect(),intervalMs);void inspect();const value=await handle.completion;if(terminal)return;adapter.validate(value);await finish('completed',value);}).catch(()=>void finish('failed'));
 });
}
function parseArgs(argv){const allowed=new Set(['exe','asar','profile','out','scenario','mib','timeout-ms']),args={};for(const arg of argv){const match=/^--([^=]+)=(.+)$/.exec(arg);if(!match||!allowed.has(match[1])||Object.hasOwn(args,match[1]))throw Error('Invalid supervisor argument');args[match[1]]=match[2];}for(const key of ['exe','asar','profile','out'])if(!path.isAbsolute(args[key]||''))throw Error('Absolute fixture paths required');const scenario=args.scenario||'startup',mib=Number(args.mib||1),timeoutMs=Number(args['timeout-ms']||(scenario==='ordered-control'?300000:120000));if(!require('../desktop/packaged-acceptance.cjs').SCENARIOS.includes(scenario)||![1,10,30].includes(mib)||scenario.startsWith('journey-')&&mib!==1||!Number.isSafeInteger(timeoutMs)||timeoutMs<10000||timeoutMs>300000||scenario==='ordered-control'&&timeoutMs!==300000)throw Error('Invalid bounded fixture scenario');return {exe:args.exe,asar:args.asar,profile:args.profile,out:args.out,scenario,mib,timeoutMs};}
async function main(argv){
 const config=parseArgs(argv),deadlineUnixMs=Date.now()+config.timeoutMs;
 let worker,complete,failed,lastStage='armed',cleanupReply,expected;
 const completion=new Promise((resolve,reject)=>{complete=resolve;failed=reject;});completion.catch(()=>{});
 const result=await supervise({
  start:async()=>{worker=new Worker(path.join(__dirname,'packaged-supervisor-worker.cjs'),{workerData:{...config,deadlineUnixMs}});worker.on('message',message=>{if(message.type==='stage')lastStage=message.stage;else if(message.type==='expected')expected=message.expected;else if(message.type==='completed')complete(message.value);else if(message.type==='failed')failed(Error('Contained fixture failed'));else if(message.type==='cleanup')cleanupReply?.(message.value);});worker.on('error',failed);worker.on('exit',code=>{if(code!==0)failed(Error('Supervisor worker exited'));});return {completion};},
  inspect:async()=>({stage:lastStage}),
  close:()=>new Promise(resolve=>{if(!worker){resolve({cleanupObserved:false});return;}cleanupReply=resolve;worker.postMessage({type:'close'});}),
  validate:value=>validateCompletion(value,expected)
 },{timeoutMs:config.timeoutMs,cleanupMs:5000});
 // Small receipt only: no command lines, nonce, profile contents or raw exceptions.
 // Invalid/unadmitted paths never gain write authority merely to report failure.
 if(expected)await fs.promises.writeFile(path.join(config.out,'supervisor-result.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify(result)+'\n');worker?.unref();process.exit(result.accepted?0:1);
}
module.exports={supervise,sameOwnedIdentity,validateCompletion,parseArgs};
if(require.main===module)main(process.argv.slice(2)).catch(()=>{process.stderr.write('Contained fixture supervisor failed before a valid receipt.\n');process.exit(1);});
