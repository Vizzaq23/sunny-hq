const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {schedulerFixture}=require('./helpers/scheduler-fixture.cjs');

// The external committed-head regression is deliberately a negative. It cannot
// become an authored contribution merely because Git subsequently conflicts.
test('public Hub conflict preparation rejects an unaccounted external head',async t=>{
 const f=await schedulerFixture(t,{onTurn:({ref})=>{
  fs.writeFileSync(path.join(ref.canonicalRoot,'src/base.txt'),'worker intent\n');
  f.gitAt(ref.canonicalRoot,['add','.']);f.gitAt(ref.canonicalRoot,['commit','-m','worker']);
 }});
 await f.plan([f.makeAssignment('author',{ownedPaths:['src']})]);await f.until(()=>f.turns.length===1);await f.complete('author');
 await f.hub.missionMutation(book=>book.data.runs[0].grant.scope.activities.push('integrate'));
 const root=f.hub.runSourceProject('r').path;
 fs.writeFileSync(path.join(root,'src/base.txt'),'external intent\n');f.gitAt(root,['add','.']);f.gitAt(root,['commit','-m','unaccounted external commit']);
 const run=f.hub.state.runs[0],s=await f.hub.evidence.gitState(root);
 const receipt=await f.hub.integrateWorkerResult({runId:'r',assignmentId:'author',head:run.assignments[0].sourceResult.headCommit,expectedRevision:run.revision,expectedSource:{baseCommit:f.base,headCommit:s.commit,fingerprint:s.fingerprint,artifactHashes:[]}});
 assert.equal(receipt.state,'conflict');assert.equal(typeof f.hub.prepareIntegrationResolution,'function','Missing public bounded conflict preparation');
 const before=fs.readFileSync(path.join(root,'src/base.txt'));
 await assert.rejects(f.hub.prepareIntegrationResolution({runId:'r',projectId:'p',expectedRevision:f.hub.state.runs[0].revision,operationId:receipt.id}),/provenance|unaccounted|chain/i);
 assert.deepEqual(fs.readFileSync(path.join(root,'src/base.txt')),before);
 assert.ok(f.hub.gate.active.has('integration:'+receipt.id));
});

async function ownedConflict(t,{prefix=true,onRepair,limit=1,holdSettlement=false,onConflict}={}){
 const commit=(root,file,body)=>{fs.writeFileSync(path.join(root,file),body);f.gitAt(root,['add','--',file]);f.gitAt(root,['commit','-m','explicit synthetic author change']);};
 const f=await schedulerFixture(t,{onBase:root=>{
  require('node:child_process').execFileSync('git',['config','core.autocrlf','false'],{cwd:root});
  fs.writeFileSync(path.join(root,'src/base.txt'),'retained base intent\nalpha\n');
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({scripts:{test:'node src/check.cjs',build:'node src/check.cjs'}}));
  fs.writeFileSync(path.join(root,'src/check.cjs'),"const a=require('assert/strict'),f=require('fs');a.equal(f.readFileSync('src/base.txt','utf8'),'retained base intent\\nfinal worker intent\\n');a.equal(f.readFileSync('src/suffix.txt','utf8'),'suffix intent');");
 },onTurn:async({ref,p})=>{
  if(ref.assignmentId==='author'){
   if(prefix)commit(ref.canonicalRoot,'src/prefix.txt','prefix intent');
   commit(ref.canonicalRoot,'src/base.txt','retained base intent\nintermediate worker intent\n');
   commit(ref.canonicalRoot,'src/base.txt','retained base intent\nfinal worker intent\n');
   commit(ref.canonicalRoot,'src/suffix.txt','suffix intent');
  }else if(ref.assignmentId.startsWith('resolution-')){
   assert.match(JSON.stringify(p.input),/untrusted data/);await onRepair?.(f,ref);
   if(prefix)commit(ref.canonicalRoot,'src/prefix.txt','prefix intent');
   commit(ref.canonicalRoot,'src/base.txt','retained base intent\nfinal worker intent\n');
   commit(ref.canonicalRoot,'src/suffix.txt','suffix intent');
  }
 }});
 const reviewer=f.makeAssignment('review',{crewId:'zoro',ownedPaths:[],dependencies:['author']});
 await f.plan([f.makeAssignment('author',{ownedPaths:['src']}),reviewer]);await f.until(()=>f.turns.includes('author'));await f.complete('author');await f.hub.scheduler().pending.get('r')?.promise;
 await f.hub.missionMutation(book=>{const r=book.data.runs[0];r.grant.scope.activities.push('integrate');r.grant.maxRepairs=limit;});
 f.run=()=>f.hub.state.runs.find(r=>r.id==='r');f.source=async()=>{const s=await f.hub.evidence.gitState(f.hub.runSourceProject('r').path);return {baseCommit:f.base,headCommit:s.commit,fingerprint:s.fingerprint,artifactHashes:[]};};
 if(holdSettlement)f.hub.settleGeneratedResolution=async()=>{};const service=f.hub.integration(),execute=service.execute.bind(service);let injected=false;f.effects=[];
 service.execute=async(w,commits,control)=>{
  f.effects.push([...commits]);
  if(!injected){injected=true;const reordered=[...commits],at=prefix?1:0;[reordered[at],reordered[at+1]]=[reordered[at+1],reordered[at]];
   // Explicit owned-command fault: reorder two dependent commits. Git itself
   // produces the real conflict and sequencer. HEAD's authored prefix remains
   // continuous, and native cherry-pick --abort restores its true start HEAD.
   const result=await execute(w,reordered,control);await onConflict?.(f);return result;
  }
  return execute(w,commits,control);
 };
 f.receipt=await f.hub.integrateWorkerResult({runId:'r',assignmentId:'author',head:f.run().assignments[0].sourceResult.headCommit,expectedRevision:f.run().revision,expectedSource:await f.source()});
 return f;
}
for(const prefix of [false,true])test('known owned Git conflict automatically prepares final-slot repair; '+(prefix?'prefix and suffix retained':'first commit conflict'),async t=>{
 const f=await ownedConflict(t,{prefix});assert.equal(f.receipt.state,'conflict');
 const op=()=>f.run().integrations[0],repairId=op().resolution.assignmentId;
 assert.equal(op().resolution.state,'prepared',JSON.stringify(f.errors));
 const schema=require('../desktop/supervision-schema.cjs');schema.validateSupervisedRun(structuredClone(f.run()));
 for(const mutate of [r=>r.integrations[0].resolution.extraAuthority=true,r=>r.integrations[0].resolution.ordinal=0,r=>r.integrations[0].resolution.finalSource=r.integrations[0].before,r=>r.assignments.find(a=>a.id===repairId).resolutionOwnership.bundleSha256='0'.repeat(64)]){const invalid=structuredClone(f.run());mutate(invalid);assert.throws(()=>schema.validateSupervisedRun(invalid),/invalid/i);}
 const historical=structuredClone(op());delete historical.resolution;
 await f.until(()=>f.turns.includes(repairId)&&f.hub.state.tasks.find(t=>t.assignmentId===repairId)?.turnId);
 assert.equal(f.run().counters.repairs,1);assert.equal(f.run().repairExhausted,true);assert.equal(f.run().phase,'blocked');
 assert.ok(f.hub.gate.active.has('integration:'+op().id));
 await f.hub.pollRunBudgets();assert.equal(f.run().stopIntent,null);
 const launches=f.run().counters.launches;assert.equal(launches,2);
 assert.throws(()=>f.hub.gate.acquire('foreign',f.original,{projectId:'p',runId:'r'}),/writing/);
 await f.complete(repairId);assert.equal(op().resolution.state,'completed',JSON.stringify(f.errors));
 const now=structuredClone(op());delete now.resolution;assert.deepEqual(now,historical,'original conflict history is immutable');
 assert.equal(f.hub.gate.active.has('integration:'+op().id),false);assert.equal(f.run().counters.repairs,1);assert.equal(f.run().counters.launches,launches);
 const root=f.hub.runSourceProject('r').path;assert.equal(fs.readFileSync(path.join(root,'src/base.txt'),'utf8'),'retained base intent\nfinal worker intent\n');assert.equal(fs.readFileSync(path.join(root,'src/suffix.txt'),'utf8'),'suffix intent');if(prefix)assert.equal(fs.readFileSync(path.join(root,'src/prefix.txt'),'utf8'),'prefix intent');
 const bundle=require('../desktop/conflict-bundle.cjs').load(f.hub,op().resolution.bundle);assert.equal(bundle.worker.commits.length,prefix?4:3);assert.equal(bundle.successfulPrefix.length,prefix?1:0);assert.match(bundle.worker.diff,/suffix intent/);
 assert.equal(await require('../desktop/mission-verification.cjs').integrationProof(f.hub,f.run(),await f.source()),true);
 const count=f.effects.length;await f.hub.settleIntegrationResolution({runId:'r',projectId:'p',expectedRevision:op().resolution.settleRevision,operationId:op().id,repairAssignmentId:repairId,repairHead:op().resolution.candidate.workerHead});assert.equal(f.effects.length,count,'completed duplicate has no Git effect');
 assert.equal((await f.hub.evidence.runCheck(root,'test')).status,'passed');
 const policy=require('../desktop/conflict-resolution.cjs'),budget=require('../desktop/run-budget.cjs');
 assert.equal(budget.budgetStatus(f.run(),{now:f.hub.budgetNow(),reserved:true,purpose:'verification'}).admit,true);
 assert.equal(budget.budgetStatus(f.run(),{now:f.hub.budgetNow()}).admit,false,'completed reservation never reopens ordinary launches');
 // Pure admission projection only: this is not persisted verification or a
 // claimed end-to-end review. Real mission-result ordering is a separate gap.
 const projected=structuredClone(f.run()),review=projected.assignments.find(a=>a.id==='review');projected.verification={integrationVerified:true,source:op().resolution.finalSource};review.baseCommit=projected.verification.source.headCommit;
 assert.equal(policy.assignmentAllowed(projected,review),true);assert.equal(policy.assignmentAllowed(projected,projected.assignments[0]),false);
 projected.integrations[0].resolution.state='unknown';assert.equal(policy.assignmentAllowed(projected,review),false);
});

test('prepared repair rejects forged identity, stale source, bundle change and recovered child; pause between children prevents second effect',async t=>{
 const f=await ownedConflict(t,{holdSettlement:true}),op=()=>f.run().integrations[0],repairId=op().resolution.assignmentId;
 await f.until(()=>f.turns.includes(repairId)&&f.hub.state.tasks.find(t=>t.assignmentId===repairId)?.turnId);await f.complete(repairId);
 const input=()=>({runId:'r',projectId:'p',expectedRevision:f.run().revision,operationId:op().id,repairAssignmentId:repairId,repairHead:f.run().assignments.find(a=>a.id===repairId).sourceResult.headCommit});
 const count=f.effects.length;
 for(const patch of [{projectId:'foreign'},{expectedRevision:0},{repairAssignmentId:'author'},{repairHead:f.base}])await assert.rejects(f.hub.settleIntegrationResolution({...input(),...patch}));
 const owner=f.run().assignments.find(a=>a.id==='author');assert.throws(()=>f.hub.assertAssignmentBinding({runId:'r',assignmentId:owner.id,workspaceId:owner.workspaceId}),/authority|transferred/);
 const repair=f.run().assignments.find(a=>a.id===repairId),root=f.run().workspaces.find(w=>w.id===repair.workspaceId).canonicalRoot;
 assert.throws(()=>f.hub.gate.acquire('forged-resolution',root,{projectId:'p',runId:'r',assignmentId:repairId,resolution:true}),/writing/);
 assert.throws(()=>f.hub.gate.acquire('ancestor',path.dirname(root),{projectId:'p',runId:'r'}),/writing/);
 const control=f.hub.integration().commands.get(op().id);control.recovered=true;await assert.rejects(f.hub.settleIntegrationResolution(input()),/controller|identity/);delete control.recovered;
 const activities=[...f.run().grant.scope.activities];f.run().grant.scope.activities=activities.filter(a=>a!=='integrate');await assert.rejects(f.hub.settleIntegrationResolution(input()),/grant/);f.run().grant.scope.activities=activities;
 const task=f.hub.state.tasks.find(t=>t.assignmentId===repairId),thread=task.threadId;task.threadId='wrong-author';await assert.rejects(f.hub.settleIntegrationResolution(input()),/author session/i);task.threadId=thread;
 const bundlePath=path.join(f.hub.home,'conflict-bundles',op().resolution.bundle.id+'.json'),bytes=fs.readFileSync(bundlePath);fs.writeFileSync(bundlePath,Buffer.alloc(bytes.length,32));await assert.rejects(f.hub.settleIntegrationResolution(input()),/bundle bytes changed/i);fs.writeFileSync(bundlePath,bytes);
 assert.equal(f.effects.length,count,'rejections have no Git mutation');
 const service=f.hub.integration(),execute=service.execute.bind(service);service.execute=async(w,commits,c)=>{const result=await execute(w,commits,c);if(commits[0]==='--abort')await f.hub.controlRun({runId:'r',projectId:'p',expectedRevision:f.run().revision,control:'pause'});return result;};
 await assert.rejects(f.hub.settleIntegrationResolution(input()),/identity|controller|authority/);
 assert.equal(f.effects.length,count+1);assert.deepEqual(f.effects.at(-1),['--abort']);assert.equal(op().resolution.state,'unknown');assert.ok(f.hub.gate.active.has('integration:'+op().id));assert.equal(f.gitAt(f.hub.runSourceProject('r').path,['rev-parse','HEAD']),op().before.headCommit);
 const {Hub}=require('../desktop/hub.cjs'),recovery=Object.create(Hub.prototype);recovery.state={runs:structuredClone(f.stored.missionBook.runs)};recovery.gate=new(require('../desktop/core.cjs').TaskGate)();recovery.integration().recover();assert.equal(recovery.integrationCommands()[0].exited,false);assert.equal(recovery.integrationCommands()[0].recovered,true);assert.ok(recovery.gate.active.has('integration:'+op().id));
});

test('another run releasing shared crew wakes the exact prepared repair without a second prepare',async t=>{
 const f=await ownedConflict(t,{onConflict:async f=>{
  const other=path.join(f.dir,'other-project');f.gitAt(f.dir,['clone','--local',f.original,other]);f.hub.state.projects.push({id:'other',path:other});
  const request=f.hub.client.request.bind(f.hub.client);f.hub.client.request=async(method,p)=>{
   if(method==='thread/start'&&p.cwd===other){const task=f.hub.state.tasks.find(t=>t.projectId==='other'&&t.captain);task.tokenUsage={total:{totalTokens:0}};return {thread:{id:'other-coordinator-thread'}};}
   if(method==='turn/start'&&p.threadId==='other-coordinator-thread')return {turn:{id:'other-coordinator-turn'}};
   return request(method,p);
  };
  const captain=await f.hub.start({projectId:'other',crewId:'luffy',title:'Synthetic other run',prompt:'Offline shared crew regression'});
  const grant=structuredClone(f.run().grant);grant.id='other-grant';grant.scope.projectId='other';grant.scope.objective='Offline shared crew regression';
  await f.hub.createRun({runId:'holder-run',projectId:'other',expectedRevision:0,parentTaskId:captain.id,objective:'Offline shared crew regression',criteria:[{id:'criterion',text:'Occupy then release crew'}],grant});
  await f.hub.captain.supervise({threadId:captain.threadId,turnId:captain.turnId,callId:'holder-plan',tool:'sunny_plan',arguments:{runId:'holder-run',projectId:'other',expectedRevision:0,assignments:[f.makeAssignment('holder',{ownedPaths:['src']})],decision:{id:'holder-decision',option:'Bounded holder',reason:'Exercise ordinary shared release',dissent:[],owner:'franky',nextAction:'Release crew',reopenEvidence:'Changed capacity'}}});
  await f.until(()=>f.turns.includes('holder')&&f.hub.state.tasks.find(t=>t.assignmentId==='holder')?.turnId);
 }});
 const op=()=>f.run().integrations[0],repairId=op().resolution.assignmentId;assert.equal(op().resolution.state,'prepared',JSON.stringify(f.errors));await f.until(()=>!f.hub.scheduler().pending.has('r'));
 assert.equal(f.run().assignments.find(a=>a.id===repairId).state,'queued');assert.equal(f.turns.includes(repairId),false);const preparationRevision=op().resolution.prepareRevision;
 await f.complete('holder','holder-run');await f.until(()=>f.turns.includes(repairId)&&f.hub.state.tasks.find(t=>t.assignmentId===repairId)?.turnId,10000);
 assert.equal(op().resolution.prepareRevision,preparationRevision);assert.equal(f.run().counters.repairs,1);assert.equal(f.run().counters.launches,2);assert.ok(f.hub.gate.active.has('integration:'+op().id));await f.complete(repairId);assert.equal(op().resolution.state,'completed');
});
