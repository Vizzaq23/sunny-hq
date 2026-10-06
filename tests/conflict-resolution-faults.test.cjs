// Private service adapter tests exercise failure ordering. These are not Git,
// provider-session, persistence-durability or end-to-end success attestations.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {IntegrationResolution}=require('../desktop/integration-resolution.cjs');
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40);
const source=head=>({baseCommit:A,headCommit:head,fingerprint:head,artifactHashes:[]});
test('ordinary non-exhausted assignment never receives the conflict budget exception',()=>{
 const run={phase:'blocked',counters:{repairs:0},grant:{maxRepairs:3},assignments:[{id:'ordinary'}],integrations:[]};
 assert.equal(require('../desktop/conflict-resolution.cjs').budgetAllowance(run,{assignmentId:'ordinary'}),false);
 assert.equal(require('../desktop/conflict-resolution.cjs').budgetAllowance(run,{purpose:'accounting'}),false);
});
function fixture(fault){
 const owner={id:'owner',capability:'implementation',taskId:'owner-task'},repair={id:'repair',capability:'implementation',taskId:'repair-task'};
 const run={id:'run',projectId:'project',revision:2,phase:'blocked',assignments:[owner,repair],authorHistory:[{taskId:'repair-task',threadId:'repair-thread',state:'ready'}]};
 const candidate={assignmentId:'repair',workspaceId:'worker',workerBase:A,workerHead:B,workerFingerprint:B,commits:[B],changedPaths:['src/a.txt']};
 const op={id:'op',assignmentId:'owner',before:source(A),resolution:{state:'prepared',assignmentId:'repair',bundle:{id:'bundle'}}};run.integrations=[op];
 const task={id:'repair-task',runId:'run',assignmentId:'repair',status:'finished',threadId:'repair-thread',turnId:'repair-turn'},control={id:'op',reservationId:'integration:op',state:'completed',exited:true},calls=[],barriers=[],released=[];
 let actual=source(A),afterAbort=false;
 const hub={state:{runs:[run],tasks:[task]},hasTaskRecoveryIntent:()=>false,gate:{release:id=>released.push(id)},evidence:{command:async(_,args)=>args[0]==='rev-list'?C+' '+A:'M\0src/a.txt\0'},missionMutation:async mutate=>{
  const image=structuredClone({runs:[run]});mutate({data:image});const next=image.runs[0].integrations[0].resolution;barriers.push(next.state);
  if(fault==='intent-write'&&next.state==='applying'||fault==='completion-write'&&next.state==='completed')throw Error(fault);
  Object.assign(run,image.runs[0]);Object.assign(op,run.integrations[0]);run.integrations[0]=op;
 }};
 const service={hub,commands:new Map([['op',control]]),run:()=>run,inspect:async()=>candidate,source:async()=>({source:actual,dirty:false}),inspectOperation:async()=>({cherryPickHead:null,unmerged:''}),execute:async(_,commits)=>{
  calls.push([...commits]);assert.equal(op.resolution.state,'applying','intent precedes either child');control.exited=true;control.state='completed';
  if(commits[0]==='--abort'){afterAbort=true;if(fault==='abort-failure')return {code:1};if(fault==='abort-mismatch')actual=source(B);if(fault==='pause-between')run.phase='paused';return {code:0};}
  actual=source(C);if(fault==='apply-response')throw Error('lost apply response');if(fault==='second-conflict')return {code:1};return {code:0};
 }};
 const resolution=new IntegrationResolution(service);resolution.prefix=async()=>{};resolution.bundles={verify:async()=>{if(fault==='bundle-drift')throw Error('bundle drift');}};
 resolution.current=(_,options={})=>{if(run.phase==='paused'||control.state==='unknown'||!(options.states||['reserved','prepared']).includes(op.resolution.state))throw Error('authority changed');return {run,op,v:op.resolution,a:repair,control,workspace:{canonicalRoot:'private-owned-workspace'}};};
 return {resolution,run,op,calls,barriers,released,control,service,input:{runId:'run',projectId:'project',operationId:'op',expectedRevision:2,repairAssignmentId:'repair',repairHead:B},get afterAbort(){return afterAbort;}};
}
for(const fault of ['bundle-drift','intent-write','abort-failure','abort-mismatch','pause-between','apply-response','second-conflict','completion-write'])test('settlement failure retains fence: '+fault,async()=>{
 const f=fixture(fault);await assert.rejects(f.resolution.settle(f.input));assert.deepEqual(f.released,[]);
 const beforeEffect=['bundle-drift','intent-write'].includes(fault);assert.equal(f.calls.length,beforeEffect?0:['apply-response','second-conflict','completion-write'].includes(fault)?2:1);
 if(!beforeEffect){assert.equal(f.op.resolution.state,'unknown');assert.equal(f.control.state,'unknown');const count=f.calls.length;await assert.rejects(f.resolution.settle(f.input));assert.equal(f.calls.length,count,'unknown is never replayed');}
 assert.equal(f.resolution.inflight.size,0);
});
for(const fault of ['bundle-write','bundle-receipt','workspace-create','prepared-receipt'])test('preparation failure does not recreate private effects: '+fault,async()=>{
 const f=fixture(),h=f.service.hub;f.op.resolution.state='reserved';delete f.op.resolution.bundle;f.op.resolution.id='bundle';f.op.workerHead=A;f.op.workspaceId='owner-workspace';f.run.assignments[0].sourceResult=source(A);
 const counts={bundle:0,workspace:0},persist=h.missionMutation;
 f.resolution.bundles={capture:async()=>({bytes:Buffer.from('complete fixture bytes')}),verify:async()=>{},write:()=>{counts.bundle++;if(fault==='bundle-write')throw Error(fault);return {id:'bundle',sha256:'f'.repeat(64),bytes:22};}};
 h.createExecutionWorkspace=async()=>{counts.workspace++;if(fault==='workspace-create')throw Error(fault);return {id:'repair-workspace'};};h.wakeCrewScheduler=()=>{throw Error('Failed preparation must not dispatch');};
 h.missionMutation=async mutate=>{const image=structuredClone({runs:[f.run]});mutate({data:image});const v=image.runs[0].integrations[0].resolution;if(fault==='bundle-receipt'&&v.state==='preparation-intent'&&v.bundle||fault==='prepared-receipt'&&v.state==='prepared')throw Error(fault);return persist(mutate);};
 const input={runId:'run',projectId:'project',operationId:'op',expectedRevision:2};await assert.rejects(f.resolution.prepare(input));assert.equal(f.op.resolution.state,'unknown');assert.deepEqual(counts,{bundle:1,workspace:['workspace-create','prepared-receipt'].includes(fault)?1:0});const retained={...counts};await assert.rejects(f.resolution.prepare(input));assert.deepEqual(counts,retained);assert.deepEqual(f.released,[]);
});
