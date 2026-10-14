const {test}=require('node:test'),assert=require('node:assert/strict');
const {currentReviewedDelivery}=require('../desktop/journey-fixture.cjs');
test('journey observation waits for the feedback attempt rather than replaying its predecessor',()=>{
 const first={id:'d1',attemptId:'a1',stage:'completed',selectedResult:{id:'result1'}},second={id:'d2',attemptId:'a2',stage:'validating',selectedResult:{id:'result2'}},run={deliveries:[first]};
 assert.equal(currentReviewedDelivery(run,{activeAttemptId:'a1',selectedResult:{id:'result1'}}),first);
 assert.equal(currentReviewedDelivery(run,{activeAttemptId:'a2'}),undefined,'feedback clears the result while the prior delivery stays completed');
 run.deliveries.push(second);
 assert.equal(currentReviewedDelivery(run,{activeAttemptId:'a2',selectedResult:{id:'result2'}}),undefined);
 second.stage='completed';
 assert.equal(currentReviewedDelivery(run,{activeAttemptId:'a2',selectedResult:{id:'result1'}}),undefined,'a different selected result is not this delivery');
 assert.equal(currentReviewedDelivery(run,{activeAttemptId:'a2',selectedResult:{id:'result2'}}),second);
});

test('restart task identity matches persisted JSON without losing assigned worker identity',()=>{
 const {journeyTaskIdentity}=require('../desktop/journey-fixture.cjs');
 for(const task of [{id:'coordinator',status:'finished',threadId:'thread',turnId:'turn'},{id:'worker',status:'finished',threadId:'thread',turnId:'turn',assignmentId:'assignment'}]){
  const saved=JSON.parse(JSON.stringify(journeyTaskIdentity(task)));
  assert.deepEqual(journeyTaskIdentity(JSON.parse(JSON.stringify(task))),saved);
  assert.notDeepEqual(journeyTaskIdentity({...task,assignmentId:'other'}),saved);
  assert.notDeepEqual(journeyTaskIdentity({...task,status:'unknown'}),saved);
 }
});
