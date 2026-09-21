const {test}=require('node:test');
const assert=require('node:assert/strict');
const {MissionBook}=require('../desktop/missions.cjs');
const brief={projectId:'p',title:'Build inventory',objective:'Track the captain inventory',acceptanceCriteria:['Items survive reload'],completionBoundary:'review'};
function running(){const book=new MissionBook();const mission=book.create(brief);const attempt=book.begin(mission.id,mission.revision);return {book,mission,attempt};}
test('new ledger is additive and rejects unknown saved schema',()=>{
 assert.deepEqual(new MissionBook().data,{version:1,missions:[]});
 assert.throws(()=>new MissionBook({version:9,missions:[]}),/version/i);
});
test('mission launch is single-use and allocates a distinct attempt',()=>{
 const {book,mission,attempt}=running();assert.ok(attempt.taskId);assert.equal(mission.status,'RUNNING');
 assert.throws(()=>book.begin(mission.id,mission.revision),/running|active/i);
 assert.throws(()=>book.create({...brief,acceptanceCriteria:[]}),/criteria/i);
});
test('coding completion awaits revision-bound captain acceptance',()=>{
 const {book,mission,attempt}=running();const launchRevision=mission.revision;
 book.sync([{id:attempt.taskId,status:'finished'}],[]);
 assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.equal(attempt.status,'finished');
 assert.throws(()=>book.accept(mission.id,launchRevision,[true]),/changed|revision/i);
 assert.throws(()=>book.accept(mission.id,mission.revision,[false]),/criteria/i);
 book.accept(mission.id,mission.revision,[true]);assert.equal(mission.status,'COMPLETE');
});
test('merge objective cannot complete from coding or a generic acceptance',()=>{
 const book=new MissionBook();const mission=book.create({...brief,completionBoundary:'merge'});const attempt=book.begin(mission.id,mission.revision);
 book.sync([{id:attempt.taskId,status:'finished'}],[]);
 assert.throws(()=>book.accept(mission.id,mission.revision,[true]),/merged|pull request/i);
});
test('uncertain attempt keeps reservation and cannot be retried',()=>{
 const {book,mission,attempt}=running();book.sync([{id:attempt.taskId,status:'unknown'}],[]);
 assert.equal(mission.connection,'reconciling');assert.equal(mission.status,'RUNNING');
 assert.throws(()=>book.begin(mission.id,mission.revision),/running|active/i);
 const restored=new MissionBook(JSON.parse(JSON.stringify(book.data)));
 assert.equal(restored.data.missions[0].connection,'reconciling');
});
test('retry keeps old evidence and ignores late completion of an earlier attempt',()=>{
 const {book,mission,attempt}=running();book.sync([{id:attempt.taskId,status:'failed'}],[]);
 const retry=book.begin(mission.id,mission.revision);assert.notEqual(attempt.id,retry.id);
 book.sync([{id:attempt.taskId,status:'finished'},{id:retry.taskId,status:'working'}],[]);
 assert.equal(attempt.status,'failed');assert.equal(mission.status,'RUNNING');assert.equal(mission.attempts.length,2);
});
test('child approval is visible and finished parent does not hide active child work',()=>{
 const {book,mission,attempt}=running();const tasks=[{id:attempt.taskId,status:'finished'},{id:'child',parentTaskId:attempt.taskId,status:'waiting'}];
 book.sync(tasks,[{taskId:'child'}]);assert.equal(mission.status,'NEEDS_USER');
 assert.ok(mission.taskIds.includes('child'));
 tasks[1].status='working';book.sync(tasks,[]);assert.equal(mission.status,'RUNNING');
 tasks[1].status='finished';book.sync(tasks,[]);assert.equal(mission.status,'WAITING_FOR_REVIEW');
});
test('failed dispatch is durable and duplicate snapshots do not grow event history',()=>{
 const {book,mission,attempt}=running();book.launchFailed(mission.id,attempt.id,'Provider unavailable');
 assert.equal(mission.status,'FAILED');assert.match(attempt.error,/unavailable/);
 const count=mission.events.length;book.sync([],[]);book.sync([],[]);assert.equal(mission.events.length,count);
});

test('retry archives previous merge review and preserves it across reload',()=>{const {book,mission,attempt}=running();book.sync([{id:attempt.taskId,status:'finished'}],[]);mission.mergeRequest={id:'old',attemptId:attempt.id,state:'merged'};const next=book.begin(mission.id,mission.revision);assert.equal(mission.mergeRequest,undefined);assert.equal(mission.mergeHistory[0].attemptId,attempt.id);assert.notEqual(next.id,attempt.id);assert.equal(new MissionBook(book.data).get(mission.id).mergeHistory[0].id,'old');});
test('uncertain merge cannot be hidden by a new attempt',()=>{const {book,mission,attempt}=running();book.sync([{id:attempt.taskId,status:'finished'}],[]);mission.mergeRequest={id:'old',attemptId:attempt.id,state:'uncertain'};assert.throws(()=>book.begin(mission.id,mission.revision),/Reconcile the merge/);assert.equal(mission.attempts.length,1);});

test('signal receipts persist without approving work and reject stale or foreign events',()=>{
 const {book,mission}=running();const foreign=book.create({...brief,projectId:'other'});
 const eventId=mission.events[0].id,revision=mission.revision,events=structuredClone(mission.events);
 book.markSignalSeen(mission.id,revision,eventId);
 assert.deepEqual(mission.seenEventIds,[eventId]);assert.equal(mission.status,'RUNNING');assert.deepEqual(mission.events,events);
 assert.equal(mission.revision,revision+1);
 assert.throws(()=>book.markSignalSeen(mission.id,revision,eventId),/changed/i);
 assert.throws(()=>book.markSignalSeen(mission.id,mission.revision,foreign.events[0].id),/signal/i);
 book.markSignalSeen(mission.id,mission.revision,eventId);assert.equal(mission.seenEventIds.length,1);
 const restored=new MissionBook(book.data);assert.deepEqual(restored.get(mission.id).seenEventIds,[eventId]);
 for(let i=0;i<501;i++)book.record(mission,'TEST_STARTED');assert.equal(mission.events.length,500);assert.deepEqual(mission.seenEventIds,[]);
});
