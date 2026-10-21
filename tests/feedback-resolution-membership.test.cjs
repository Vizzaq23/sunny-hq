// Pure policy regression; the existing real-Git audit/grant journeys remain acceptance evidence.
const {test}=require('node:test'),assert=require('node:assert/strict');
const feedback=require('../desktop/feedback-epochs.cjs');
const graph=require('../desktop/assignment-graph.cjs');
const waves=require('../desktop/production-waves.cjs');
function fixture(){
 const head='a'.repeat(40),workerHead='b'.repeat(40),source={baseCommit:head,headCommit:workerHead,fingerprint:'worker-source',artifactHashes:[]},before={baseCommit:head,headCommit:head,fingerprint:'before-source',artifactHashes:[]};
 const owner={id:'owner',crewId:'franky',roleId:'builder',capability:'implementation',objective:'Actual owner',ownedPaths:['src/a.cjs'],dependencies:[],criteriaIds:['criterion'],baseCommit:head,state:'finished',workspaceId:'owner-workspace',taskId:'owner-task',sourceResult:source};
 const repair={id:'resolution-operation',crewId:owner.crewId,roleId:owner.roleId,capability:owner.capability,objective:'Bound repair',ownedPaths:[...owner.ownedPaths],dependencies:[owner.id],criteriaIds:[...owner.criteriaIds],baseCommit:head,state:'queued',workspaceId:'repair-workspace',resolutionOwnership:{operationId:'operation',fromAssignmentId:owner.id,fromWorkspaceId:owner.workspaceId,source:structuredClone(source),bundleSha256:'c'.repeat(64)}};
 const op={id:'operation',state:'conflict',assignmentId:owner.id,workspaceId:owner.workspaceId,before,resolution:{version:1,id:'resolution-receipt',runId:'run',projectId:'project',operationId:'operation',ordinal:1,assignmentId:repair.id,before:structuredClone(before),state:'prepared',prepareRevision:1,bundle:{id:'resolution-receipt',sha256:'c'.repeat(64),bytes:1},workspaceId:repair.workspaceId}};
 const run={id:'run',projectId:'project',revision:2,ordinary:{checkpointWaves:1},currentEpoch:{id:'epoch',assignmentIds:[owner.id],productionWaves:waves.derive([owner])},assignments:[owner,repair],integrations:[op],workspaces:[{id:repair.workspaceId,assignmentId:repair.id,baseCommit:head}],counters:{repairs:1},grant:{maxRepairs:1},phase:'blocked'};
 return {run,owner,repair,op};
}
test('current-epoch generated repair is not its own historical owner and reaches scheduler eligibility',()=>{
 const {run,repair}=fixture();
 assert.equal(feedback.current(run,repair),true);
 assert.equal(feedback.oldOwners(run).some(a=>a.id===repair.id),false);
 assert.equal(graph.readyAssignments(run,{tasks:[]}).some(a=>a.id===repair.id),true);
 // Outcome admission uses this same membership predicate after real completion.
 repair.state='finished';assert.equal(feedback.current(run,repair),true);
});
test('generated membership does not mutate sealed graph ids and becomes historical with its owner',()=>{
 const {run,owner,repair}=fixture(),ids=structuredClone(run.currentEpoch.assignmentIds);
 assert.equal(feedback.current(run,repair),true);assert.deepEqual(run.currentEpoch.assignmentIds,ids);
 run.epochs=[structuredClone(run.currentEpoch)];run.currentEpoch={id:'next',assignmentIds:['new-owner']};
 assert.equal(feedback.current(run,owner),false);assert.equal(feedback.current(run,repair),false);
 assert.deepEqual(feedback.oldOwners(run).map(a=>a.id),[owner.id,repair.id]);
});
test('resolution-shaped and corrupted generated records do not gain current membership',()=>{
 const {run,repair,op}=fixture();
 const fake={...repair,id:'resolution-forged'};run.assignments.push(fake);assert.equal(feedback.current(run,fake),false);
 op.resolution.before.headCommit='d'.repeat(40);assert.equal(feedback.current(run,repair),false);
});
test('a bound generated repair cannot bypass overlapping historical ownership handoffs',()=>{
 const {run,owner,repair}=fixture();
 const prior={...structuredClone(owner),id:'prior-owner',taskId:'prior-task',workspaceId:'prior-workspace'};
 run.assignments.unshift(prior);run.epochs=[{id:'prior-epoch',assignmentIds:[prior.id]}];
 assert.equal(feedback.current(run,repair),true);assert.equal(feedback.oldOwners(run).includes(prior),true);
 assert.equal(graph.readyAssignments(run,{tasks:[]}).some(a=>a.id===repair.id),false);
});

const resolution=require('../desktop/conflict-resolution.cjs');
const {CrewScheduler}=require('../desktop/crew-scheduler.cjs');
function atReceipt(state){
 const f=fixture(),v=f.op.resolution;
 v.state=state;
 if(state==='reserved'){
  delete v.prepareRevision;delete v.bundle;delete v.workspaceId;
  delete f.repair.resolutionOwnership;delete f.repair.workspaceId;f.run.workspaces=[];
 }else if(state==='preparation-intent'){
  // The first durable preparation intent precedes bundle/ownership/workspace installation.
  delete v.bundle;delete v.workspaceId;delete f.repair.resolutionOwnership;delete f.repair.workspaceId;f.run.workspaces=[];
 }
 return f;
}
function withCandidate(state){
 const f=fixture(),{run,repair,op}=f,v=op.resolution,workerHead='e'.repeat(40);
 repair.state='finished';repair.taskId='repair-task';
 repair.sourceResult={baseCommit:repair.baseCommit,headCommit:workerHead,fingerprint:'repair-source',artifactHashes:[]};
 run.authorHistory=[{taskId:repair.taskId,threadId:'repair-thread',state:'ready'}];
 Object.assign(v,{state,settleRevision:2,candidate:{assignmentId:repair.id,workspaceId:repair.workspaceId,workerBase:repair.baseCommit,workerHead,workerFingerprint:repair.sourceResult.fingerprint,commits:[workerHead],changedPaths:['src/a.cjs']},author:{taskId:repair.taskId,threadId:'repair-thread',turnId:'repair-turn'}});
 if(state==='completed'){
  op.command={id:op.id,state:'completed'};
  Object.assign(v,{abortSource:structuredClone(op.before),abortResult:{code:0,observedExit:true},resultingCommits:['f'.repeat(40)],finalSource:{baseCommit:op.before.baseCommit,headCommit:'f'.repeat(40),fingerprint:'final-source',artifactHashes:[]}});
 }
 return f;
}
test('generated membership survives valid reservation and preparation before provider dispatch',()=>{
 for(const state of ['reserved','preparation-intent']){
  const {run,repair,op}=atReceipt(state);repair.state='blocked';
  assert.doesNotThrow(()=>resolution.validate(run,op),state);
  assert.equal(feedback.current(run,repair),true,state);
  assert.equal(resolution.assignmentAllowed(run,repair),false,'membership alone cannot launch '+state);
 }
 // During preparation-intent the retained bundle/ownership may be installed before workspace creation.
 const f=fixture();f.op.resolution.state='preparation-intent';delete f.op.resolution.workspaceId;
 delete f.repair.workspaceId;f.run.workspaces=[];f.repair.state='blocked';
 assert.doesNotThrow(()=>resolution.validate(f.run,f.op));assert.equal(feedback.current(f.run,f.repair),true);
});
test('prepared generated membership remains stable across assignment launch and capture states',()=>{
 for(const state of ['queued','reserved','starting','working','waiting','finished']){
  const {run,repair,op}=fixture();repair.state=state;
  if(state!=='queued')repair.launchReservationId='repair-launch';
  if(['starting','working','waiting','finished'].includes(state))repair.taskId='repair-task';
  assert.doesNotThrow(()=>resolution.validate(run,op),state);
  assert.equal(feedback.current(run,repair),true,state);
  assert.equal(feedback.oldOwners(run).some(a=>a.id===repair.id),false,state);
 }
});
test('applying and completed repairs retain membership only with candidate and author bindings',()=>{
 for(const state of ['applying','completed']){
  const {run,repair,op}=withCandidate(state);
  assert.doesNotThrow(()=>resolution.validate(run,op),state);
  assert.equal(feedback.current(run,repair),true,state);
  op.resolution.candidate.workerHead='9'.repeat(40);
  assert.equal(feedback.current(run,repair),false,'stale candidate '+state);
 }
 const f=withCandidate('applying');f.run.authorHistory[0].threadId='different-thread';
 assert.equal(feedback.current(f.run,f.repair),false,'stale author session');
 const completed=withCandidate('completed');completed.op.resolution.abortSource.headCommit='9'.repeat(40);
 assert.equal(feedback.current(completed.run,completed.repair),false,'stale abort source');
});
test('unknown resolution stays current for recovery without receiving a launch allowance',async()=>{
 const {run,repair,op}=fixture();op.resolution.state='unknown';op.resolution.error='Uncertain retained effect';
 assert.doesNotThrow(()=>resolution.validate(run,op));
 assert.equal(feedback.current(run,repair),true);
 assert.equal(resolution.assignmentAllowed(run,repair),false);
 assert.equal(resolution.entitled(run),false);
 let launches=0;const scheduler=new CrewScheduler({getRun:()=>run,start:()=>{launches++;}});
 await scheduler.drain(run.id);assert.equal(launches,0,'blocked run with unknown resolution cannot dispatch');
 run.phase='unknown';await scheduler.drain(run.id);assert.equal(launches,0,'unknown run cannot dispatch');
});
test('stale ownership, bundle, workspace and extra fields cannot confer generated membership',()=>{
 const changes={
  ownership:f=>{f.repair.resolutionOwnership.source.fingerprint='stale-source';},
  bundle:f=>{f.op.resolution.bundle.sha256='d'.repeat(64);},
  workspace:f=>{f.op.resolution.workspaceId='unrelated-workspace';},
  extraReceiptField:f=>{f.op.resolution.untrustedGrant=true;},
  extraOwnershipField:f=>{f.repair.resolutionOwnership.untrustedGrant=true;},
  absentCanonicalRecord:f=>{f.run.assignments=f.run.assignments.filter(a=>a.id!==f.repair.id);}
 };
 for(const [name,change] of Object.entries(changes)){
  const f=fixture();change(f);assert.equal(feedback.current(f.run,f.repair),false,name);
 }
});
