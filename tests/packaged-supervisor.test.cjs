const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const api=()=>require('../scripts/packaged-supervisor.cjs');
const never=()=>new Promise(()=>{});
const identity={pid:41,creation:'133000000000000000',executable:'C:\\fixture\\Sunny HQ.exe',manifest:'C:\\private\\fixture.json',parentPid:10,parentCreation:'132999999999999999'};
const packageProof={exeSha256:'a'.repeat(64),asarSha256:'b'.repeat(64),scenario:'startup'};
const receipt=()=>({version:1,scenario:'startup',exeSha256:packageProof.exeSha256,asarSha256:packageProof.asarSha256,ownedProcessesExited:true,phases:[{pid:41,phase:1,scenario:'startup',executableSha256:packageProof.exeSha256,asarSha256:packageProof.asarSha256,providerEffects:0,ownedRoot:{...identity}}]});
const completion=()=>({exitCode:0,job:{atomic:true,verified:true,cleanupObserved:true,activeProcesses:0,timedOut:false,forcedStop:false},evidence:receipt(),registrations:[{...identity}]});
const options={timeoutMs:35,cleanupMs:15,intervalMs:5};
test('external deadline is armed before a never-returning launch and never invents cleanup',async()=>{
 const start=performance.now();const result=await api().supervise({start:never,inspect:never,close:never,validate:()=>true},options);
 assert.equal(result.status,'timeout');assert.equal(result.cleanup,'unresolved');assert.equal(result.accepted,false);assert.ok(performance.now()-start<1000);
});
test('hung observation and late answers cannot replace terminal deadline or acquire ownership',async()=>{
 let answer,observations=0,closed=0;const pending=new Promise(resolve=>answer=resolve);
 const result=await api().supervise({start:async()=>({completion:never()}),inspect:()=>{observations++;return pending;},close:async()=>{closed++;return {cleanupObserved:true,activeProcesses:0};},validate:()=>true},options);
 const retained=JSON.stringify(result);answer({stage:'late',identity});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(result.status,'timeout');assert.equal(result.accepted,false);assert.equal(observations,1);assert.equal(closed,1);assert.equal(JSON.stringify(result),retained);
});
test('a completed helper is insufficient when containment or cleanup was not observed',async()=>{
 for(const changes of [{atomic:false},{verified:false},{cleanupObserved:false},{activeProcesses:1},{timedOut:true},{forcedStop:true}]){
  const value=completion();Object.assign(value.job,changes);
  const result=await api().supervise({start:async()=>({completion:Promise.resolve(value)}),inspect:never,close:async()=>({cleanupObserved:false}),validate:value=>api().validateCompletion(value,packageProof)},options);
  assert.equal(result.accepted,false);assert.equal(result.status,'failed');
 }
});
test('job assignment failure never resumes helper code and timeout closes only its created job',async()=>{
 let closed=0;const result=await api().supervise({start:async()=>{throw Error('atomic job assignment failed before resume');},inspect:never,close:async()=>{closed++;return {cleanupObserved:true,activeProcesses:0};},validate:()=>true},options);
 assert.equal(result.status,'failed');assert.equal(result.accepted,false);assert.equal(closed,1);
});
test('process ownership rejects PID reuse, wrong executable, manifest, parent generation and Node exceptions',()=>{
 assert.equal(api().sameOwnedIdentity(identity,{...identity}),true);
 for(const change of [{pid:42},{creation:'reused'},{executable:'C:\\foreign\\Sunny HQ.exe'},{manifest:'C:\\foreign.json'},{parentCreation:'reused-parent'}])assert.equal(api().sameOwnedIdentity(identity,{...identity,...change}),false);
 const node={...identity,executable:'C:\\Program Files\\nodejs\\node.exe',nodeSha256:'c'.repeat(64),runner:'C:\\private\\playable-builds\\runner.cjs'};
 assert.equal(api().sameOwnedIdentity(node,{...node}),true);for(const change of [{nodeSha256:'d'.repeat(64)},{runner:'C:\\foreign.cjs'},{parentPid:999}])assert.equal(api().sameOwnedIdentity(node,{...node,...change}),false);
 assert.equal(api().sameOwnedIdentity(null,identity),false);
 assert.equal(api().sameOwnedIdentity(identity,{...identity,permission:'kill'}),false);
});
test('valid job exit still requires exact package phase identities and zero provider effects',async()=>{
 assert.equal(api().validateCompletion(completion(),packageProof),true);
 for(const change of [value=>value.evidence.phases[0].providerEffects=1,value=>value.evidence.phases[0].pid=0,value=>value.evidence.phases[0].asarSha256='c'.repeat(64),value=>value.exitCode=124,value=>value.evidence.ownedProcessesExited=false,value=>value.registrations=[],value=>value.registrations[0].creation='reused']){const value=completion();change(value);assert.throws(()=>api().validateCompletion(value,packageProof));}
 const result=await api().supervise({start:async()=>({completion:Promise.resolve(completion())}),inspect:never,close:async()=>({cleanupObserved:true,activeProcesses:0}),validate:value=>api().validateCompletion(value,packageProof)},options);assert.equal(result.accepted,true);assert.equal(result.cleanup,'observed');
});
test('native adapter uses atomic private job admission without breakaway or PID termination fallback',()=>{
 const native=fs.readFileSync(path.join(__dirname,'../scripts/packaged-job.cs'),'utf8');
 assert.match(native,/0x0002000D/);assert.match(native,/0x00002000/);assert.match(native,/IsProcessInJob/);assert.match(native,/ResumeThread/);assert.match(native,/QueryInformationJobObject/);assert.doesNotMatch(native,/AssignProcessToJobObject|CREATE_BREAKAWAY|Process\.GetProcessById/);
 const worker=fs.readFileSync(path.join(__dirname,'../scripts/packaged-supervisor-worker.cjs'),'utf8');assert.match(worker,/windowsHide:\s*true/);assert.doesNotMatch(worker,/process\.kill\(/);
});
