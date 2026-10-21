// Persisted-schema counterexamples only. This fixture is not evidence of Git
// execution, author dispatch, durable completion or mission readiness.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createSupervisedRun}=require('../desktop/supervised-runs.cjs');
const {validateSupervisedRun}=require('../desktop/supervision-schema.cjs');
const policy=require('../desktop/conflict-resolution.cjs');
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40),D='d'.repeat(40),E='e'.repeat(40),F='f'.repeat(40);
const source=head=>({baseCommit:A,headCommit:head,fingerprint:head,artifactHashes:[]});
function fixture(){
 const run=createSupervisedRun({runId:'r',projectId:'p',expectedRevision:0,objective:'Counterexample fixture',criteria:[{id:'c',text:'Bound receipts'}],grant:{id:'g',createdBy:'captain',scope:{projectId:'p',objective:'Counterexample fixture',activities:['read','write','integrate']},maxWorkers:3,maxInitialAssignments:16,maxLaunches:32,maxRepairs:3,workerMs:900000,activeMs:3600000,tokenLimit:100000,improvementMs:0,improvementTokens:0}},{now:0});
 const binding=require('../desktop/crew-registry.cjs').crewBinding('franky'),opId='operation',repairId='resolution-'+opId,bundleId='11111111-1111-4111-8111-111111111111';
 const assignment=(id,workspaceId,head,dependencies=[])=>({id,crewId:'franky',roleId:binding.roleId,capability:'implementation',objective:'Counterexample fixture',ownedPaths:['src'],criteriaIds:['c'],dependencies,baseCommit:A,state:'finished',taskId:id+'-task',workspaceId,sourceResult:source(head)});
 run.assignments=[assignment('owner','owner-workspace',B),assignment(repairId,'repair-workspace',C,['owner'])];
 run.workspaces=['owner-workspace','repair-workspace','integration-workspace'].map((id,i)=>({id,projectId:'p',runId:'r',canonicalRoot:require('node:path').join(require('node:os').tmpdir(),'sunny-schema-only-'+id),gitCommonDir:'fixture-git-common',branch:'fixture-'+id,baseCommit:A,state:'ready',...(i===2?{integration:true}:{assignmentId:run.assignments[i].id})}));
 run.authorHistory=run.assignments.map(a=>({id:a.id+'-execution',taskId:a.taskId,provider:'synthetic',time:0,state:'ready',threadId:a.id+'-thread'}));
 run.counters.repairs=1;run.revision=4;run.phase='validating';
 const op={id:opId,assignmentId:'owner',workspaceId:'owner-workspace',workerBase:A,workerHead:B,workerFingerprint:B,commits:[B],changedPaths:['src/a.txt'],before:source(A),after:source(A),resultingCommits:[],time:0,state:'conflict',command:{id:opId,state:'completed'}};
 op.resolution={version:1,id:bundleId,runId:'r',projectId:'p',operationId:opId,ordinal:1,assignmentId:repairId,before:source(A),state:'completed',prepareRevision:1,settleRevision:2,bundle:{id:bundleId,sha256:'a'.repeat(64),bytes:20},workspaceId:'repair-workspace',candidate:{assignmentId:repairId,workspaceId:'repair-workspace',workerBase:A,workerHead:C,workerFingerprint:C,commits:[D,C],changedPaths:['src/a.txt']},author:{taskId:repairId+'-task',threadId:repairId+'-thread',turnId:'repair-turn'},abortSource:source(A),abortResult:{code:0,observedExit:true},resultingCommits:[E,F],finalSource:source(F)};
 run.assignments[1].resolutionOwnership={operationId:opId,fromAssignmentId:'owner',fromWorkspaceId:'owner-workspace',source:source(B),bundleSha256:'a'.repeat(64)};run.integrations=[op];return run;
}
test('schema fixture is a valid internally consistent terminal receipt',()=>{const run=fixture();validateSupervisedRun(run);assert.ok(policy.contribution(run,run.integrations[0]));});
for(const [name,mutate]of [['wrong final head',r=>r.resolution.finalSource.headCommit=D],['duplicated result commit',r=>r.resolution.resultingCommits=[F,F]],['unknown original command',r=>r.command.state='unknown'],['wrong original operation',r=>r.command.id='other-operation']])test('contradictory terminal receipt stays fenced: '+name,()=>{
 const run=fixture(),op=run.integrations[0];mutate(op);assert.throws(()=>validateSupervisedRun(run),/invalid/i);assert.equal(policy.contribution(run,op),null);assert.equal(policy.completed(run),false);assert.equal(policy.summary(run),undefined);
 const {Hub}=require('../desktop/hub.cjs'),recovery=Object.create(Hub.prototype);recovery.state={runs:[run]};recovery.gate=new(require('../desktop/core.cjs').TaskGate)();recovery.integration().recover();assert.ok(recovery.gate.active.has('integration:'+op.id));assert.equal(recovery.integrationCommands()[0].exited,false);
});
