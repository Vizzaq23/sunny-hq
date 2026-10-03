const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash}=require('node:crypto');
const control=require('../scripts/ordered-control-check.cjs');
const root=path.resolve(__dirname,'..');
const hashFile=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixtureHash='219f75242146fb32b8ed8452a0b792b1c76207311b67f74b947b267cc8581590';
const protocolHash='cfbf13474db6cfd574cd072e386a9db405168e587eb0ac9be4f0297650a63afd';
function isolated(t){
 const moved=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-portable-control-'));
 t.after(()=>fs.rmSync(moved,{recursive:true,force:true}));
 fs.cpSync(path.join(root,'desktop'),path.join(moved,'desktop'),{recursive:true});
 for(const relative of ['tests/helpers/frozen-control-fixture.cjs','docs/evidence/protocols/ordered-control-2026-10-02.md','desktop/mission-profile.cjs']){
  const destination=path.join(moved,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});
  if(fs.existsSync(path.join(root,relative)))fs.copyFileSync(path.join(root,relative),destination);
 }
 return moved;
}
test('portable inputs preserve the frozen workload',t=>{
 assert.equal(typeof control.resolveControlInputs,'function','Portable input resolution must exist');
 const moved=isolated(t),inputs=control.resolveControlInputs(moved);
 assert.equal(hashFile(inputs.fixtureFile),fixtureHash);
 assert.equal(hashFile(inputs.protocolFile),protocolHash);
 const {loadFrozenControlFixture,inspectFrozenWorkload}=require('./helpers/frozen-control-loader.cjs');
 const fixture=inspectFrozenWorkload(loadFrozenControlFixture(inputs.fixtureFile,moved).fixture(1,moved));
 assert.equal(fixture.messagesPerTask,40);
 assert.equal(fixture.charactersPerMessage,1024);
 assert.equal(fixture.utf8BytesPerMessage,1026);
});
test('moved isolated checkout resolves inputs without its former sibling',t=>{
 assert.equal(typeof control.resolveControlInputs,'function','Portable input resolution must exist');
 const moved=isolated(t),inputs=control.resolveControlInputs(moved);
 assert.equal(inputs.fixtureFile,path.join(moved,'tests/helpers/frozen-control-fixture.cjs'));
 assert.equal(inputs.protocolFile,path.join(moved,'docs/evidence/protocols/ordered-control-2026-10-02.md'));
 assert.equal(inputs.fixtureSha256,fixtureHash);assert.equal(inputs.protocolSha256,protocolHash);
 const {loadFrozenControlFixture}=require('./helpers/frozen-control-loader.cjs');
 assert.equal(loadFrozenControlFixture(inputs.fixtureFile,moved).fixture(1,moved).missionBook.missions[0].status,'WAITING_FOR_REVIEW');
});
test('mutated fixture fails before loading or sampling',t=>{
 assert.equal(typeof control.resolveControlInputs,'function','Portable input resolution must exist');
 const moved=isolated(t),fixtureFile=path.join(moved,'tests/helpers/frozen-control-fixture.cjs');
 fs.appendFileSync(fixtureFile,'\nthrow Error("must never execute");\n');
 assert.throws(()=>control.resolveControlInputs(moved),/Frozen fixture source hash must match/);
 const {loadFrozenControlFixture}=require('./helpers/frozen-control-loader.cjs');
 assert.throws(()=>loadFrozenControlFixture(fixtureFile,moved),/Frozen fixture source hash must match before loading/);
});
test('mutated protocol fails before loading or sampling',t=>{
 assert.equal(typeof control.resolveControlInputs,'function','Portable input resolution must exist');
 const moved=isolated(t);fs.appendFileSync(path.join(moved,'docs/evidence/protocols/ordered-control-2026-10-02.md'),'altered');
 assert.throws(()=>control.resolveControlInputs(moved),/Frozen protocol source hash must match/);
});

// These assertions catch gate weakening: unknown proof must never become eligibility.
const gatePath=path.join(__dirname,'helpers/reliability-gate.cjs');
const gate=fs.existsSync(gatePath)?require(gatePath):{};
function evaluateGate(report){
 assert.equal(typeof gate.evaluateReliabilityGate,'function','Missing fail-closed reliability evaluator contract');
 return gate.evaluateReliabilityGate(report);
}
function syntheticCompleteGateReport(){
 return {fixtureOnly:true,spontaneousCrashCauseVerified:true,providerEffects:0,historyLoss:0,
  nativeRawProofComplete:true,exactPackageA4RawProofComplete:true,fullStateRawProofComplete:true,
  measurements:[1,10,30].map(sizeMiB=>({sizeMiB,stopSamples:20,approvalSamples:20,stopFailures:0,approvalFailures:0,
   stopP95Ms:100,approvalP95Ms:100,mainTimerExcessMaxMs:50,queueDurabilityRawProofComplete:true}))};
}
test('reliability gate rejects missing and unknown causal/native/full-state facts',()=>{
 assert.equal(evaluateGate({}).status,'BLOCKED');
 for(const key of ['spontaneousCrashCauseVerified','nativeRawProofComplete','exactPackageA4RawProofComplete','fullStateRawProofComplete']){
  for(const value of [undefined,null,false,'unknown']){
   const report=syntheticCompleteGateReport();report[key]=value;
   assert.equal(evaluateGate(report).status,'BLOCKED',key+' must fail closed');
  }
 }
 for(const key of ['providerEffects','historyLoss'])for(const value of [undefined,null,1,'0']){
  const report=syntheticCompleteGateReport();report[key]=value;
  assert.equal(evaluateGate(report).status,'BLOCKED',key+' requires numeric zero');
 }
});
test('reliability gate rejects known historical 10 and 30 MiB failures',()=>{
 const historical=JSON.parse(fs.readFileSync(path.join(root,'docs/evidence/sunny-reliability-6199600/historical-measurements.json'),'utf8'));
 for(const size of [10,30]){
  const row=historical.find(item=>item.sizeMiB===size),report=syntheticCompleteGateReport();
  Object.assign(report.measurements.find(item=>item.sizeMiB===size),row);
  const result=evaluateGate(report);assert.equal(result.status,'BLOCKED');
  assert.ok(result.reasons.includes(size+'MiB stop p95'));assert.ok(result.reasons.includes(size+'MiB approval p95'));
  if(size===30)assert.ok(result.reasons.includes('30MiB timer excess'));
 }
});
test('reliability gate retains strict frozen thresholds and complete sample requirements',()=>{
 assert.equal(evaluateGate(syntheticCompleteGateReport()).status,'FACTS_COMPLETE');
 for(const [key,value] of [['stopP95Ms',200],['approvalP95Ms',200],['mainTimerExcessMaxMs',100.01],
  ['stopSamples',19],['approvalSamples',19],['stopFailures',1],['approvalFailures',1],
  ['queueDurabilityRawProofComplete',undefined],['stopP95Ms',NaN],['approvalP95Ms',Infinity]]){
  const report=syntheticCompleteGateReport();report.measurements[0][key]=value;
  assert.equal(evaluateGate(report).status,'BLOCKED',key+'='+value);
 }
 const report=syntheticCompleteGateReport();report.measurements.pop();assert.equal(evaluateGate(report).status,'BLOCKED');
 const duplicate=syntheticCompleteGateReport();duplicate.measurements.push({...duplicate.measurements[0]});
 assert.equal(evaluateGate(duplicate).status,'BLOCKED');
});
test('reliability gate rejects fresh failing source-runtime measurements without promoting native invokes',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/evidence/sunny-reliability-6199600/measurement-manifest.json'),'utf8'));
 const report=syntheticCompleteGateReport();report.measurements=manifest.measurements.map(row=>({...row,queueDurabilityRawProofComplete:true}));
 const result=evaluateGate(report);assert.equal(result.status,'BLOCKED');
 for(const size of [10,30])for(const control of ['stop','approval'])assert.ok(result.reasons.includes(size+'MiB '+control+' p95'));
 assert.ok(result.reasons.includes('30MiB timer excess'));
 report.exactPackageA4RawProofComplete=manifest.exactPackageA4RawProofComplete;
 assert.ok(evaluateGate(report).reasons.includes('exactPackageA4RawProofComplete'));
});
