const {test} = require('node:test');
const assert = require('node:assert/strict');
const {replay, validate} = require('../scripts/replay-pending-approval.cjs');
const observation = () => ({version: 1, source: 'synthetic', method: 'item/commandExecution/requestApproval', threadId: 'thread-a', turnId: 'turn-a', oldRpcId: 77, replayedRpcId: 77, status: 'inProgress', observationSeconds: 30});
test('same RPC ID replay still requires a new local approval and one explicit decline', async () => {
  const result = await replay(observation());
  assert.equal(result.passed, true); assert.equal(result.liveProviderProof, false); assert.equal(result.recordedReplayPresent, true);
});
test('replacement RPC ID has the same stale-decision protections', async () => {
  assert.equal((await replay({...observation(), replayedRpcId: 81})).passed, true);
});
test('no replay does not fabricate an approval or claim live verification', async () => {
  const result = await replay({...observation(), replayedRpcId: null});
  assert.equal(result.outcome, 'no-replay-observed-remains-unverified'); assert.equal(result.liveProviderProof, false);
});
test('a provider label never upgrades in-memory replay to live proof', async () => {
  assert.equal((await replay({...observation(), source: 'redacted-provider-observation'})).liveProviderProof, false);
});
test('reject incomplete, unsupported and unredacted observations', () => {
  for (const changed of [{replayedRpcId: undefined}, {oldRpcId: '77'}, {method: 'item/fileChange/requestApproval'}, {status: 'completed'}, {observationSeconds: 0}, {command: 'private command'}, {threadId: '../private'}])
    assert.throws(() => validate({...observation(), ...changed}));
});
