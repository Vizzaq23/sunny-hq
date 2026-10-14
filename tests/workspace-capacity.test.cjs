const {test}=require('node:test'),assert=require('node:assert/strict');
const {schedulerFixture}=require('./helpers/scheduler-fixture.cjs');
test('workspace preparation waits for a writer and resumes once without an admission failure',async t=>{
 const f=await schedulerFixture(t);
 // The contained package permits only distinct managed worker roots, never the original checkout.
 f.hub.gate.fixtureScopeEnforcement=({root,otherRoot})=>root!==otherRoot&&[root,otherRoot].every(value=>value.startsWith(require('node:path').resolve(f.hub.managedWorkspaceRoot).toLowerCase()+require('node:path').sep));
 const scheduler=f.hub.scheduler(),prepare=scheduler.deps.prepare;
 scheduler.deps.prepare=async(a,run)=>{if(a.id==='second')await f.until(()=>f.turns.includes('first'));return prepare(a,run);};
 const admission=[];scheduler.deps.onAdmissionError=async(...args)=>admission.push(args[2]);
 await f.plan([f.makeAssignment('first'),f.makeAssignment('second',{crewId:'sanji'})]);
 await f.until(()=>f.turns.includes('first'));
 await f.hub.scheduler().idle();
 assert.deepEqual(admission.map(e=>e.message),[]);
 const queued=f.hub.state.runs[0].assignments.find(a=>a.id==='second');
 assert.equal(queued.state,'queued');assert.equal(queued.launchReservationId,undefined);assert.equal(queued.workspaceId,undefined);
 assert.deepEqual(f.turns,['first']);
 await f.complete('first');
 await f.until(()=>f.turns.includes('second'));
 await f.hub.scheduler().idle();
 assert.deepEqual(f.turns,['first','second']);assert.deepEqual(admission,[]);assert.deepEqual(f.errors,[]);
 await f.complete('second');
});

