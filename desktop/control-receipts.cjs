// Fixed ordered-control provenance and receipt checks. No application starts on import.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const FIXTURE='219f75242146fb32b8ed8452a0b792b1c76207311b67f74b947b267cc8581590',PROTOCOL='cfbf13474db6cfd574cd072e386a9db405168e587eb0ac9be4f0297650a63afd';
const ENTRIES=Object.freeze(['scripts/ordered-control-check.cjs','tests/helpers/frozen-control-loader.cjs','tests/helpers/frozen-control-fixture.cjs','docs/evidence/protocols/ordered-control-2026-10-02.md','desktop/packaged-control.cjs','desktop/control-receipts.cjs','desktop/persistence-worker.cjs','desktop/ordered-store.cjs','desktop/preload.cjs','dist/build-info.json']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const workloadMetadata=new Map();
function frozenWorkload(mib,executable){
 assert.ok([1,10,30].includes(mib));assert.ok(path.isAbsolute(executable));
 const packageRoot=path.join(path.dirname(executable),'resources','app.asar'),key=JSON.stringify([mib,packageRoot]);
 if(!workloadMetadata.has(key)){
  const root=path.resolve(__dirname,'..'),{fixture}=require('../tests/helpers/frozen-control-loader.cjs').loadFrozenControlFixture(path.join(root,'tests/helpers/frozen-control-fixture.cjs'),root);
  const originalPath=fixture(1).projects[0].path,packagePath=path.join(packageRoot,'tests/helpers/synthetic-project');
  // The frozen generator's byte target includes its original __dirname path.
  // Translate only that byte-count offset when checking from the controller's
  // checkout, then restore the actual package path. No measured input changes.
  const delta=Buffer.byteLength(JSON.stringify(packagePath))-Buffer.byteLength(JSON.stringify(originalPath));
  const initial=fixture(mib-delta/(1024*1024));initial.projects[0].path=packagePath;
  const metadata={initialCompactBytes:Buffer.byteLength(JSON.stringify(initial)),...require('../scripts/ordered-control-check.cjs').validateFrozenTextShape(initial),fixtureSha256:FIXTURE,missionTasks:initial.missionBook.missions[0].taskIds,initialMissionStatus:initial.missionBook.missions[0].status};
  workloadMetadata.set(key,metadata);
 }
 return workloadMetadata.get(key);
}
function assertMandatoryAssertions(raw,packageProof){
 const expected=[
  {name:'exact declared frozen workload shape and hash validated before samples',details:raw.fixture},
  {name:'mandatory startup recovery awaited'}, {name:'built full App rendered'},
  {name:'renderer isolation enabled',details:{contextIsolation:true,sandbox:true,nodeIntegration:false}}, {name:'renderer has no Node'},
  ...raw.method.controls.flatMap(action=>[{name:action+' all 20 raw controls completed',details:{count:20,failures:0}},{name:action+' unchanged p95 RTT <200ms',details:raw.metrics[action].rttMs},{name:action+' unchanged main 1ms timer excess <=100ms',details:{continuous1ms:raw.metrics[action].mainContinuous1msExcessMs,supplementaryOperationTimers:raw.metrics[action].mainTimerExcessMs}}]),
  {name:'all mutated warmups succeeded'},{name:'full transcript/draft/opaque state survives close/reopen',details:raw.afterCloseProof},
  {name:'source/build frozen throughout process',details:{sourceDigest:packageProof.sourceDigest,builtDigest:packageProof.builtDigest}}, {name:'no runtime errors',details:{errors:[]}},
 ].map(a=>({...a,status:'pass'}));
 assert.deepEqual(raw.assertions,expected);
}
function assetProof(root){
 const entries=Object.fromEntries(ENTRIES.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
 assert.equal(entries[ENTRIES[2]],FIXTURE);assert.equal(entries[ENTRIES[3]],PROTOCOL);
 function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{assert.ok(!entry.isSymbolicLink());return entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)];});}
 const built=walk(path.join(root,'dist')).sort().map(file=>({file:path.relative(root,file).split(path.sep).join('/'),sha256:sha(fs.readFileSync(file))}));
 assert.ok(built.some(item=>item.file==='dist/index.html'));
 const buildInfo=JSON.parse(fs.readFileSync(path.join(root,'dist/build-info.json'),'utf8'));
 return {entries,buildInfo,built,builtDigest:sha(JSON.stringify(built)),fixtureSha256:FIXTURE,protocolSha256:PROTOCOL};
}
function validateResult(raw,{mib,packageProof}={}){
 assert.equal(raw.synthetic,true);assert.equal(raw.sizeMiB,mib);assert.equal(raw.passed,true);assert.deepEqual(raw.errors,[]);
 assert.deepEqual(raw.source,packageProof);assert.equal(raw.latencyProbe.enabled,false);
 assert.equal(raw.method.samplesPerControl,20);assert.equal(raw.method.warmupsPerControl,3);assert.equal(raw.method.percentile,'nearest-rank');assert.equal(raw.method.noGC,true);assert.equal(raw.method.noNetwork,true);assert.equal(raw.method.fixtureSha256,FIXTURE);
 assert.deepEqual(raw.method.controls,['task:interrupt','approval:respond']);
 assert.equal(raw.samples.length,40);assert.equal(raw.warmups.length,6);assert.equal(raw.timerControls.length,20);assert.ok(raw.timerControls.every(n=>Number.isFinite(n)&&n>=0));
 assertMandatoryAssertions(raw,packageProof);
 assert.equal(raw.cleanup.windowsDestroyed,true);assert.equal(raw.cleanup.orderedStoreClosed,true);assert.equal(raw.cleanup.readonlyWorkersRemaining,0);assert.ok(raw.finishedAt);
 assert.equal(raw.syntheticMethods.mode,'finite-offline');assert.equal(raw.syntheticMethods.blockedAttempts,0);assert.equal(raw.syntheticMethods.providerEffects,0);assert.equal(raw.syntheticMethods.calls,raw.providerCalls.length);
 function runtime(value){assert.equal(value?.electron,raw.runtime.electron);assert.equal(value?.node,raw.runtime.node);assert.equal(value?.executable,raw.runtime.executable);assert.ok(Number.isSafeInteger(value.threadId)&&value.threadId>0);}
 assert.equal(raw.runtime.executableSha256,packageProof.executableSha256);assert.match(raw.runtime.electron,/^44\./);
 assert.equal(raw.persistenceWorkers.length,2);for(const worker of raw.persistenceWorkers){runtime(worker.runtime);assert.equal(worker.entry,worker.runtime.entry);assert.ok(worker.entry.endsWith(path.join('app.asar','desktop','persistence-worker.cjs')));assert.ok(worker.epoch);}
 assert.notEqual(raw.persistenceWorkers[0].epoch,raw.persistenceWorkers[1].epoch);
 assert.deepEqual(raw.fixture,frozenWorkload(mib,raw.runtime.executable));
 function receipt(value,epoch){assert.equal(value?.epoch,epoch);assert.ok(Number.isSafeInteger(value.sequence)&&value.sequence>0);assert.match(value.stateSha256,/^[a-f0-9]{64}$/);assert.ok(Number.isFinite(value.durableAt)&&value.durableAt>0);}
 receipt(raw.initialReceipt,raw.persistenceWorkers[0].epoch);assert.equal(raw.initialReceipt.sequence,1);
 assert.ok(Array.isArray(raw.submissions));
 function proof(p){
  assert.equal(p.exactWholeState,true);assert.equal(p.receiptMatches,true);assert.equal(p.stateSha256,p.expectedStateSha256);assert.match(p.stateSha256,/^[a-f0-9]{64}$/);assert.equal(p.journalMode,'wal');runtime(p.runtime);assert.ok(Number.isSafeInteger(p.compactBytes)&&p.compactBytes>=mib*1024*1024);
  for(const key of ['fullTranscriptsSha256','workspaceSha256'])assert.match(p[key],/^[a-f0-9]{64}$/);
  assert.deepEqual(p.opaqueRoot,{preserve:'synthetic future data',text:'OPAQUE'.repeat(256)});assert.deepEqual(p.opaqueBook,{preserve:'yes'});assert.deepEqual(p.opaqueProject,{preserve:'yes'});assert.deepEqual(p.opaqueMission,{keep:true});
 }
 proof(raw.afterCloseProof);
 for(const action of raw.method.controls){
  const measured=raw.samples.filter(s=>s.action===action),warmups=raw.warmups.filter(s=>s.action===action);
  assert.deepEqual(measured.map(s=>s.index),Array.from({length:20},(_,i)=>i));assert.deepEqual(warmups.map(s=>s.index),[-3,-2,-1]);
  for(const sample of [...warmups,...measured]){
   assert.equal(sample.id,action+':'+sample.index);assert.equal(sample.warmup,sample.index<0);assert.equal(sample.success,true);assert.equal(sample.semanticPass,true);assert.equal(sample.pendingAtControlAdmission,true);assert.equal(sample.requiredReceiptsPresent,true);assert.equal(sample.renderer.outcome,'fulfilled');assert.equal(sample.explicitFailureReply,false);
   assert.ok(!sample.proofFailure&&!sample.backgroundFailure&&!sample.rendererEvaluationFailure);assert.equal(require('../scripts/ordered-control-check.cjs').explicitFailure(sample.renderer.reply),false);assert.ok(Number.isFinite(sample.renderer.rttMs)&&sample.renderer.rttMs>=0);
   proof(sample.proof);assert.equal(sample.proof.fixtureTasks,raw.fixture.initialTasks);assert.equal(sample.proof.missionStatus,'WAITING_FOR_REVIEW');
   const reasons=action==='task:interrupt'?['reservation-release']:['dispatch','mission'];
   assert.ok(Number.isSafeInteger(sample.submissionStart)&&sample.submissionStart>=0);
   const submissions=raw.submissions.filter(s=>s.sampleId===sample.id);
   assert.ok(submissions.length>0);assert.deepEqual(raw.submissions.slice(sample.submissionStart,sample.submissionStart+submissions.length),submissions);
   const recorded=submissions.map(({reason,receipt,failure,syncHandoffMs,awaitedReceiptMs})=>({reason,receipt,...(failure===undefined?{}:{failure}),syncHandoffMs,awaitedReceiptMs}));
   assert.deepEqual(sample.receipts,recorded);
   const background=sample.receipts.filter(r=>r.reason===null);assert.equal(background.length,1);assert.equal(sample.receipts[0],background[0]);
   receipt(sample.backgroundReceipt,raw.persistenceWorkers[1].epoch);assert.deepEqual(sample.backgroundReceipt,background[0].receipt);
   let previousSequence=0;
   for(const record of sample.receipts){assert.ok(!record.failure);receipt(record.receipt,raw.persistenceWorkers[1].epoch);assert.ok(record.receipt.sequence>previousSequence);previousSequence=record.receipt.sequence;assert.ok(Number.isFinite(record.syncHandoffMs)&&record.syncHandoffMs>=0&&Number.isFinite(record.awaitedReceiptMs)&&record.awaitedReceiptMs>=0);}
   assert.ok(reasons.every(reason=>sample.receipts.some(r=>r.reason===reason)));
   assert.equal(sample.receipts.at(-1).receipt.stateSha256,sample.proof.stateSha256);
   const task=sample.proof.task;assert.equal(task.id,'offline-control');assert.equal(task.threadId,'offline-control-thread');
   if(action==='task:interrupt'){
    assert.equal(sample.reservationReleased,true);assert.equal(task.status,'interrupted');assert.equal(sample.provider.filter(call=>call.method==='turn/interrupt').length,1);
   }else{
    assert.equal(sample.approvalBoundAndSubmitted,true);assert.equal(task.status,'working');const intent=task.approvalResponseIntent;
    assert.equal(intent.state,'submitted');assert.ok(intent.approvalId);assert.equal(intent.decision,sample.decision);assert.equal(intent.threadId,task.threadId);assert.equal(intent.turnId,task.turnId);assert.equal(intent.executionId,task.executionId);assert.ok(intent.submittedAt>=intent.createdAt);assert.deepEqual(intent.result,{decision:sample.decision});
    const replies=sample.provider.filter(call=>call.method==='respond');assert.equal(replies.length,1);assert.equal(replies[0].id,'offline-rpc-'+sample.index);assert.deepEqual(replies[0].result,intent.result);
   }
   for(const key of ['mainContinuous1msExcessMs','heartbeatExcessMs'])assert.ok(sample[key].length&&sample[key].every(n=>Number.isFinite(n)&&n>=0));
   for(const period of [1,5]){const observations=sample.mainMonitorObservations.filter(o=>o.periodMs===period);assert.equal(observations.at(-1)?.phase,'settlement-tail');assert.deepEqual(observations.map(o=>o.excessMs),sample[period===1?'mainContinuous1msExcessMs':'heartbeatExcessMs']);}
   assert.ok(sample.mainTimers.length&&sample.mainTimers.every(t=>Number.isFinite(t.excessMs)&&t.excessMs>=0));
  }
  const summarize=require('../scripts/ordered-control-check.cjs').summarize,metrics=raw.metrics[action];
  assert.equal(metrics.count,20);assert.equal(metrics.failures,0);
  assert.deepEqual(metrics.rttMs,summarize(measured.map(s=>s.renderer.rttMs)));assert.ok(metrics.rttMs.p95<200);
  assert.deepEqual(metrics.mainContinuous1msExcessMs,summarize(measured.flatMap(s=>s.mainContinuous1msExcessMs)));assert.ok(metrics.mainContinuous1msExcessMs.max<=100);
  assert.deepEqual(metrics.mainTimerExcessMs,summarize(measured.flatMap(s=>s.mainTimers.map(t=>t.excessMs))));assert.ok(metrics.mainTimerExcessMs.max<=100);
 }
 return true;
}
function validatePhase(summary,{mib,packageProof,resultBytes,eventBytes,ownedRoot}={}){
 assert.equal(summary.version,1);assert.equal(summary.scenario,'ordered-control');assert.equal(summary.phase,1);assert.equal(summary.sizeMiB,mib);assert.equal(summary.passed,true);assert.equal(summary.providerEffects,0);assert.equal(summary.realProviderEffects,0);assert.equal(summary.providerMode,'finite-offline');
 assert.equal(summary.frozenFixtureSha256,FIXTURE);assert.equal(summary.protocolSha256,PROTOCOL);assert.equal(summary.rawResultSha256,sha(resultBytes));assert.equal(summary.rawEventsSha256,sha(eventBytes));
 assert.equal(summary.executableSha256,packageProof.executableSha256);assert.equal(summary.asarSha256,packageProof.asarSha256);assert.deepEqual(summary.packageProof,packageProof);assert.deepEqual(summary.rootGeneration,ownedRoot);assert.equal(summary.pid,ownedRoot.pid);
 const raw=JSON.parse(resultBytes);assert.equal(raw.runtime.executable,ownedRoot.executable);validateResult(raw,{mib,packageProof});
 const events=String(eventBytes).trim().split('\n').map(line=>JSON.parse(line));assert.equal(events.at(-1)?.kind,'finalized');assert.equal(events.at(-1).passed,true);assert.deepEqual(events.at(-1).cleanup,raw.cleanup);
 assert.deepEqual(events.filter(e=>e.kind==='sample').map(({kind,...s})=>s),[...raw.warmups,...raw.samples].sort((a,b)=>raw.method.controls.indexOf(a.action)-raw.method.controls.indexOf(b.action)||a.index-b.index));
 assert.deepEqual(events.filter(e=>e.kind==='assertion').map(({kind,...a})=>a),raw.assertions);
 assert.deepEqual(summary.completed,{warmups:6,stop:20,approval:20,idle:20,correctness:true,timing:true,cleanup:true});return true;
}
function packagedHost(admission){
 require('./packaged-acceptance.cjs').assertFixtureCapability(admission);
 assert.equal(admission.scenario,'ordered-control');assert.equal(admission.phase,1);
 const {app}=require('electron'),root=path.resolve(__dirname,'..'),asarFile=path.join(process.resourcesPath,'app.asar');
 assert.equal(app.isPackaged,true);assert.equal(root.toLowerCase(),asarFile.toLowerCase());assert.equal(app.getAppPath().toLowerCase(),root.toLowerCase());
 const proof=()=>{const assets=assetProof(root),identity=require('./packaged-acceptance.cjs').hashPackageFiles({exeFile:process.execPath,asarFile});return {kind:'exact-package',...assets,...identity,sourceDigest:sha(JSON.stringify({entries:assets.entries,...identity}))};};
 return {proof,summary:raw=>{
  const after=proof();assert.deepEqual(after,raw.source);validateResult(raw,{mib:admission.mib,packageProof:after});
  const resultBytes=fs.readFileSync(path.join(admission.outputDir,'result.json')),eventBytes=fs.readFileSync(path.join(admission.outputDir,'events.jsonl'));
  const rootGeneration=JSON.parse(fs.readFileSync(path.join(admission.outputDir,'root-registration-1.json'),'utf8'));assert.equal(rootGeneration.pid,process.pid);assert.equal(rootGeneration.executable.toLowerCase(),process.execPath.toLowerCase());
  const summary={version:1,scenario:'ordered-control',phase:1,sizeMiB:admission.mib,pid:process.pid,rootGeneration,admissionSha256:sha(admission.nonce),...{executableSha256:after.executableSha256,asarSha256:after.asarSha256},packageProof:after,frozenFixtureSha256:FIXTURE,protocolSha256:PROTOCOL,rawResultSha256:sha(resultBytes),rawEventsSha256:sha(eventBytes),providerMode:'finite-offline',providerEffects:0,realProviderEffects:0,passed:true,completed:{warmups:6,stop:20,approval:20,idle:20,correctness:true,timing:true,cleanup:true}};
  validatePhase(summary,{mib:admission.mib,packageProof:after,resultBytes,eventBytes,ownedRoot:rootGeneration});fs.writeFileSync(path.join(admission.outputDir,'phase-1.json'),JSON.stringify(summary,null,2),{flag:'wx',mode:0o600});
 }};
}
module.exports={ENTRIES,FIXTURE,PROTOCOL,sha,assetProof,validateResult,validatePhase,packagedHost};
