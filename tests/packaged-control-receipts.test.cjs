const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const receipts=require('../desktop/control-receipts.cjs'),{summarize}=require('../scripts/ordered-control-check.cjs');
function valid(mib=1,executable='C:\\fixture\\Sunny HQ.exe'){
 const hash='a'.repeat(64),runtime={electron:'44.4.3',node:'24.18.0',executable,threadId:1},entry=path.join(path.dirname(executable),'resources','app.asar','desktop','persistence-worker.cjs');
 const packageProof={kind:'exact-package',executableSha256:hash,asarSha256:hash,sourceDigest:hash,builtDigest:hash};
 const proof={runtime,stateSha256:hash,expectedStateSha256:hash,exactWholeState:true,receiptMatches:true,journalMode:'wal',compactBytes:1024,fixtureTasks:1,missionStatus:'WAITING_FOR_REVIEW',fullTranscriptsSha256:hash,workspaceSha256:hash,opaqueRoot:{preserve:'synthetic future data',text:'OPAQUE'.repeat(256)},opaqueBook:{preserve:'yes'},opaqueProject:{preserve:'yes'},opaqueMission:{keep:true}};
 const raw={synthetic:true,sizeMiB:1,passed:true,errors:[],source:packageProof,latencyProbe:{enabled:false},method:{samplesPerControl:20,warmupsPerControl:3,percentile:'nearest-rank',noGC:true,noNetwork:true,fixtureSha256:receipts.FIXTURE,controls:['task:interrupt','approval:respond']},samples:[],warmups:[],timerControls:Array(20).fill(1),assertions:Array.from({length:12},(_,i)=>({name:String(i),status:'pass'})),cleanup:{windowsDestroyed:true,orderedStoreClosed:true,readonlyWorkersRemaining:0},finishedAt:'2026-10-06',syntheticMethods:{mode:'finite-offline',blockedAttempts:0,providerEffects:0,calls:0},providerCalls:[],runtime:{...runtime,executableSha256:hash},persistenceWorkers:Array.from({length:2},(_,i)=>({entry,epoch:'epoch-'+i,runtime:{...runtime,entry}})),afterCloseProof:proof,fixture:{initialTasks:1},metrics:{}};
 // Evaluate the exact byte-verified frozen fixture with the package's original
 // __dirname, independently of the validator's workload reconstruction.
 const fixtureFile=path.join(__dirname,'helpers/frozen-control-fixture.cjs'),bytes=fs.readFileSync(fixtureFile);assert.equal(receipts.sha(bytes),receipts.FIXTURE);
 const packageRoot=path.join(path.dirname(runtime.executable),'resources','app.asar'),fixtureDir=path.join(packageRoot,'tests/helpers'),module={exports:{}};
 const original=path.resolve(fixtureDir,'../../sunny-responsive-20261001/desktop/mission-profile.cjs');
 const boundedRequire=id=>{if(id==='node:path'||id==='node:assert/strict')return require(id);if(id===original)return {inspectMissionProfile:()=>({mode:'v2'})};throw Error('Unexpected frozen dependency');};
 new(require('node:vm').Script)('(function(require,module,exports,__dirname){'+bytes+'\n})').runInThisContext()(boundedRequire,module,module.exports,fixtureDir);
 const initial=module.exports.fixture(mib);initial.missionBook={...initial.missionBook,version:3,runs:[]};raw.sizeMiB=mib;
 raw.fixture={initialCompactBytes:Buffer.byteLength(JSON.stringify(initial)),...require('../scripts/ordered-control-check.cjs').validateFrozenTextShape(initial),fixtureSha256:receipts.FIXTURE,missionTasks:initial.missionBook.missions[0].taskIds,initialMissionStatus:'WAITING_FOR_REVIEW'};
 Object.assign(proof,{compactBytes:raw.fixture.initialCompactBytes+1024,fixtureTasks:raw.fixture.initialTasks});
 raw.initialReceipt={epoch:'epoch-0',sequence:1,stateSha256:hash,durableAt:1};raw.submissions=[];let sequence=0;
 for(const action of raw.method.controls){for(let index=-3;index<20;index++){
  const sample={id:action+':'+index,index,action,warmup:index<0,success:true,semanticPass:true,pendingAtControlAdmission:true,requiredReceiptsPresent:true,renderer:{outcome:'fulfilled',rttMs:1},explicitFailureReply:false,proof,receipts:(action==='task:interrupt'?['reservation-release']:['dispatch','mission']).map(reason=>({reason,receipt:{epoch:'epoch',sequence:1,stateSha256:hash}})),reservationReleased:true,approvalBoundAndSubmitted:true,mainContinuous1msExcessMs:[1],heartbeatExcessMs:[1],mainMonitorObservations:[{periodMs:1,phase:'settlement-tail',excessMs:1},{periodMs:5,phase:'settlement-tail',excessMs:1}],mainTimers:[{excessMs:1}]};
  sample.proof=structuredClone(proof);sample.proof.task={id:'offline-control',threadId:'offline-control-thread',turnId:'turn',executionId:'execution',status:action==='task:interrupt'?'interrupted':'working'};
  if(action==='task:interrupt')sample.provider=[{method:'turn/interrupt'}];else{sample.decision='decline';const result={decision:sample.decision};sample.proof.task.approvalResponseIntent={state:'submitted',approvalId:'approval',decision:sample.decision,threadId:'offline-control-thread',turnId:'turn',executionId:'execution',submittedAt:2,createdAt:1,result};sample.provider=[{method:'respond',id:'offline-rpc-'+index,result}];}
  sample.submissionStart=raw.submissions.length;
  sample.receipts=[null,...(action==='task:interrupt'?['reservation-release']:['dispatch','mission'])].map(reason=>({reason,receipt:{epoch:'epoch-1',sequence:++sequence,stateSha256:hash,durableAt:sequence+1},syncHandoffMs:1,awaitedReceiptMs:2}));
  sample.backgroundReceipt=structuredClone(sample.receipts[0].receipt);
  raw.submissions.push(...sample.receipts.map(r=>({...r,sampleId:sample.id,startedAtMs:sequence})));
  (sample.warmup?raw.warmups:raw.samples).push(sample);
 }raw.metrics[action]={count:20,failures:0,rttMs:summarize(Array(20).fill(1)),mainContinuous1msExcessMs:summarize(Array(20).fill(1)),mainTimerExcessMs:summarize(Array(20).fill(1))};}
 raw.assertions=[
  {name:'exact declared frozen workload shape and hash validated before samples',details:raw.fixture},
  {name:'mandatory startup recovery awaited'}, {name:'built full App rendered'},
  {name:'renderer isolation enabled',details:{contextIsolation:true,sandbox:true,nodeIntegration:false}}, {name:'renderer has no Node'},
  ...raw.method.controls.flatMap(action=>[{name:action+' all 20 raw controls completed',details:{count:20,failures:0}},{name:action+' unchanged p95 RTT <200ms',details:raw.metrics[action].rttMs},{name:action+' unchanged main 1ms timer excess <=100ms',details:{continuous1ms:raw.metrics[action].mainContinuous1msExcessMs,supplementaryOperationTimers:raw.metrics[action].mainTimerExcessMs}}]),
  {name:'all mutated warmups succeeded'},{name:'full transcript/draft/opaque state survives close/reopen',details:raw.afterCloseProof},
  {name:'source/build frozen throughout process',details:{sourceDigest:hash,builtDigest:hash}}, {name:'no runtime errors',details:{errors:[]}},
 ].map(a=>({...a,status:'pass'}));
 const ownedRoot={pid:41,creation:'133000000000000000',executable:runtime.executable,manifest:'C:\\private\\fixture.json',parentPid:10,parentCreation:'132999999999999999'};
 const resultBytes=Buffer.from(JSON.stringify(raw)),eventBytes=Buffer.from([...raw.assertions.map(a=>({kind:'assertion',...a})),...[...raw.warmups,...raw.samples].sort((a,b)=>raw.method.controls.indexOf(a.action)-raw.method.controls.indexOf(b.action)||a.index-b.index).map(s=>({kind:'sample',...s})),{kind:'finalized',passed:true,cleanup:raw.cleanup}].map(e=>JSON.stringify(e)).join('\n')+'\n');
 const summary={version:1,scenario:'ordered-control',phase:1,sizeMiB:1,pid:41,passed:true,providerEffects:0,realProviderEffects:0,providerMode:'finite-offline',frozenFixtureSha256:receipts.FIXTURE,protocolSha256:receipts.PROTOCOL,rawResultSha256:receipts.sha(resultBytes),rawEventsSha256:receipts.sha(eventBytes),executableSha256:hash,asarSha256:hash,packageProof,rootGeneration:ownedRoot,completed:{warmups:6,stop:20,approval:20,idle:20,correctness:true,timing:true,cleanup:true}};
 summary.sizeMiB=mib;return {raw,summary,expected:{mib,packageProof,resultBytes,eventBytes,ownedRoot}};
}
function reseal(v){
 v.expected.resultBytes=Buffer.from(JSON.stringify(v.raw));
 v.expected.eventBytes=Buffer.from([...v.raw.assertions.map(a=>({kind:'assertion',...a})),...[...v.raw.warmups,...v.raw.samples].sort((a,b)=>v.raw.method.controls.indexOf(a.action)-v.raw.method.controls.indexOf(b.action)||a.index-b.index).map(s=>({kind:'sample',...s})),{kind:'finalized',passed:true,cleanup:v.raw.cleanup}].map(e=>JSON.stringify(e)).join('\n')+'\n');
 v.summary.rawResultSha256=receipts.sha(v.expected.resultBytes);v.summary.rawEventsSha256=receipts.sha(v.expected.eventBytes);
}
test('fixed assets include build-info under dist and missing or tampered frozen assets fail',()=>{
 const root=fs.mkdtempSync(path.join(__dirname,'../.sunny-dev/control-assets-'));
 try{for(const entry of receipts.ENTRIES){const dest=path.join(root,entry);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,entry==='dist/build-info.json'?'{}':fs.readFileSync(path.join(__dirname,'..',entry)));}fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist/index.html'),'synthetic');const proof=receipts.assetProof(root);assert.equal(proof.fixtureSha256,receipts.FIXTURE);assert.ok(proof.built.some(p=>p.file==='dist/build-info.json'));fs.appendFileSync(path.join(root,receipts.ENTRIES[2]),'tamper');assert.throws(()=>receipts.assetProof(root));fs.unlinkSync(path.join(root,receipts.ENTRIES[2]));assert.throws(()=>receipts.assetProof(root));}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('complete raw samples proofs events package and generation validate together',()=>{const v=valid();assert.equal(receipts.validatePhase(v.summary,v.expected),true);});
test('unchanged frozen workload metadata matches all sizes and actual package path lengths',()=>{
 for(const mib of [1,10,30]){const v=valid(mib,path.join('C:\\','synthetic-package-'.repeat(8),'Sunny HQ.exe'));assert.equal(receipts.validatePhase(v.summary,v.expected),true);}
});
test('forged or partial summary wrong provenance stale root and tampered raw digests reject',()=>{
 for(const mutate of [v=>v.summary.completed.stop=19,v=>v.summary.passed=false,v=>v.summary.rawResultSha256='0'.repeat(64),v=>v.expected.eventBytes=Buffer.from('{}'),v=>v.summary.rootGeneration={...v.summary.rootGeneration,creation:'133000000000000001'},v=>v.summary.packageProof={...v.summary.packageProof,asarSha256:'0'.repeat(64)},v=>v.summary.sizeMiB=10,v=>delete v.summary.completed.cleanup]){const v=valid();mutate(v);assert.throws(()=>receipts.validatePhase(v.summary,v.expected));}
});
test('raw validation requires every sample exact proof timer warmup and completed cleanup',()=>{
 for(const mutate of [r=>r.samples.pop(),r=>r.warmups[0].success=false,r=>r.cleanup.orderedStoreClosed=false,r=>r.samples[0].proof={...r.samples[0].proof,exactWholeState:false},r=>r.samples[0].pendingAtControlAdmission=false,r=>r.samples[0].mainMonitorObservations.pop(),r=>r.syntheticMethods.blockedAttempts=1,r=>r.persistenceWorkers[0].runtime={...r.persistenceWorkers[0].runtime,electron:'43'},r=>r.samples[0].receipts=[],r=>r.metrics['task:interrupt'].rttMs.p95=200,r=>r.timerControls.pop()]){const v=valid();mutate(v.raw);assert.throws(()=>receipts.validateResult(v.raw,v.expected));}
});
test('supervisor requires raw validation plus normal exit and independently empty owned job',()=>{
 const {validateCompletion}=require('../scripts/packaged-supervisor.cjs');
 function completion(){const v=valid(),phase={...v.summary,ownedRoot:v.expected.ownedRoot};return {value:{exitCode:0,job:{atomic:true,verified:true,cleanupObserved:true,activeProcesses:0,timedOut:false,forcedStop:false},evidence:{scenario:'ordered-control',exeSha256:v.summary.executableSha256,asarSha256:v.summary.asarSha256,ownedProcessesExited:true,phases:[phase]},registrations:[v.expected.ownedRoot],controlArtifacts:{resultBytes:v.expected.resultBytes,eventBytes:v.expected.eventBytes}},expected:{scenario:'ordered-control',exeSha256:v.summary.executableSha256,asarSha256:v.summary.asarSha256,mib:1,packageProof:v.expected.packageProof}};}
 const validValue=completion();assert.equal(validateCompletion(validValue.value,validValue.expected),true);
 for(const mutate of [v=>v.exitCode=1,v=>v.job.cleanupObserved=false,v=>v.job.timedOut=true,v=>v.job.activeProcesses=1,v=>v.evidence.phases[0].rootGeneration={...v.registrations[0],creation:'reused'},v=>delete v.controlArtifacts,v=>v.controlArtifacts.resultBytes=Buffer.from('{"passed":true}'),v=>v.evidence.phases.push(v.evidence.phases[0])]){const v=completion();mutate(v.value);assert.throws(()=>validateCompletion(v.value,v.expected));}
});
test('passing flags cannot replace complete transcript draft opaque and semantic proof fields',()=>{
 const v=valid();delete v.raw.samples[0].proof.fullTranscriptsSha256;
 assert.throws(()=>receipts.validateResult(v.raw,v.expected));
});
for(const [name,change] of [
 ['missing background receipt',r=>delete r.samples[0].backgroundReceipt],
 ['missing null-reason receipt',r=>r.samples[0].receipts.shift()],
 ['missing recorded background submission',r=>r.submissions.splice(r.samples[0].submissionStart,1)],
 ['wrong background receipt association',r=>r.samples[0].backgroundReceipt.sequence++],
 ['wrong control submission association',r=>r.submissions[r.samples[0].submissionStart+1].receipt={...r.submissions[r.samples[0].submissionStart+1].receipt,stateSha256:'b'.repeat(64)}],
 ['missing initial receipt',r=>delete r.initialReceipt],
 ['wrong initial worker epoch',r=>r.initialReceipt.epoch='foreign'],
 ['missing frozen shape',r=>delete r.fixture.messagesPerTask],
 ['wrong frozen task count',r=>r.fixture.initialTasks--],
 ['wrong frozen compact size',r=>r.fixture.initialCompactBytes=1024],
 ['wrong frozen mission tasks',r=>r.fixture.missionTasks.pop()],
 ['undersize full-row proof',r=>r.samples[0].proof.compactBytes=1024],
 ['missing mandatory readiness assertion',r=>r.assertions=r.assertions.filter(a=>a.name!=='renderer has no Node')],
 ['invented assertion substitutes for shape',r=>r.assertions[0].name='invented'],
 ['wrong renderer isolation proof',r=>r.assertions.find(a=>a.name==='renderer isolation enabled').details.sandbox=false],
])test('matching raw/event digests cannot admit '+name,()=>{const v=valid();change(v.raw);reseal(v);assert.throws(()=>receipts.validatePhase(v.summary,v.expected));});
test('consistent omission of all background receipts still fails with recomputed digests',()=>{
 const v=valid(),samples=[...v.raw.warmups,...v.raw.samples].sort((a,b)=>v.raw.method.controls.indexOf(a.action)-v.raw.method.controls.indexOf(b.action)||a.index-b.index);v.raw.submissions=[];
 for(const sample of samples){delete sample.backgroundReceipt;sample.receipts=sample.receipts.filter(r=>r.reason!==null);sample.submissionStart=v.raw.submissions.length;v.raw.submissions.push(...sample.receipts.map(r=>({...r,sampleId:sample.id,startedAtMs:1})));}
 reseal(v);assert.throws(()=>receipts.validatePhase(v.summary,v.expected));
});
test('consistent smaller workload flags cannot replace the actual frozen size',()=>{
 const v=valid();v.raw.fixture.initialTasks=1;v.raw.fixture.initialMessages=40;v.raw.fixture.initialCompactBytes=1024;
 for(const sample of [...v.raw.warmups,...v.raw.samples]){sample.proof.fixtureTasks=1;sample.proof.compactBytes=1024;}v.raw.afterCloseProof.fixtureTasks=1;v.raw.afterCloseProof.compactBytes=1024;
 reseal(v);assert.throws(()=>receipts.validatePhase(v.summary,v.expected));
});
