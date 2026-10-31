// Replays redacted observations through real Hub/CodexClient code with IN-MEMORY
// transport and storage. Never connects to a provider; this is not live proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {EventEmitter} = require('node:events');
const {PassThrough} = require('node:stream');
const {Hub} = require('../desktop/hub.cjs');
const {receiptStore} = require('../tests/helpers/receipt-store.cjs');
function validate(record) {
  assert.equal(record.version, 1);
  assert.ok(['synthetic', 'redacted-provider-observation'].includes(record.source));
  assert.equal(record.method, 'item/commandExecution/requestApproval');
  for (const key of ['threadId', 'turnId']) assert.match(record[key], /^[a-zA-Z0-9_-]{1,80}$/);
  for (const key of ['oldRpcId', 'replayedRpcId'])
    if (key === 'oldRpcId' || record[key] !== null) assert.ok(Number.isSafeInteger(record[key]) && record[key] >= 0);
  assert.equal(record.status, 'inProgress');
  assert.ok(Number.isInteger(record.observationSeconds) && record.observationSeconds > 0 && record.observationSeconds <= 300);
  const keys = ['version', 'source', 'method', 'threadId', 'turnId', 'oldRpcId', 'replayedRpcId', 'status', 'observationSeconds'];
  assert.ok(Object.keys(record).every(key => keys.includes(key)), 'Do not include raw provider text, commands, paths or credentials.');
}
function peer() {
  const child = new EventEmitter();
  child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
  return child;
}
async function replay(record) {
  validate(record);
  const hub = new Hub({home: process.cwd(), store: receiptStore({load: () => ({}), save: () => {}, close: () => {}}),
    catalog: {discoverProjects: () => [{id: 'fixture-project', path: process.cwd()}], discoverTools: () => [], discoverAutomations: () => []}});
  const task = {id: 'fixture-task', projectId: 'fixture-project', crewId: 'franky', threadId: record.threadId, turnId: record.turnId, status: 'working', messages: []};
  hub.state.tasks.push(task);
  const old = peer(), current = peer(), writes = [];
  const emit = (child, message) => child.stdout.write(JSON.stringify(message) + '\n');
  const request = id => ({id, method: record.method, params: {threadId: record.threadId, turnId: record.turnId, command: '[redacted fixture command]'}});
  try {
    hub.client.attach(old); hub.state.codex.status = 'connected'; emit(old, request(record.oldRpcId));
    const prior = hub.state.approvals[0]; assert.ok(prior); assert.equal(task.status, 'waiting');
    hub.client.disconnect('recorded disconnect');
    assert.equal(task.status, 'unknown'); assert.equal(hub.state.approvals.length, 0);
    await assert.rejects(hub.respond({id: prior.id, decision: 'accept'}), /no longer pending/);
    current.stdin.on('data', data => {
      const message = JSON.parse(String(data)); writes.push(message);
      if (message.method === 'thread/read') emit(current, {id: message.id, result: {thread: {status: {type: 'active', activeFlags: ['waitingOnApproval']}, turns: [{id: record.turnId, status: record.status, items: []}]}}});
    });
    hub.client.attach(current); hub.state.codex.status = 'connected'; await hub.checkStatus(task.id);
    assert.equal(task.status, 'waiting');
    emit(old, request(record.oldRpcId)); assert.equal(hub.state.approvals.length, 0);
    if (record.replayedRpcId !== null) {
      emit(current, request(record.replayedRpcId));
      const fresh = hub.state.approvals[0]; assert.ok(fresh); assert.notEqual(fresh.id, prior.id);
      await assert.rejects(hub.respond({id: prior.id, decision: 'accept'}), /no longer pending/);
      assert.equal(writes.filter(message => message.result).length, 0, 'No response before a fresh decision');
      await hub.respond({id: fresh.id, decision: 'decline'});
      assert.deepEqual(writes.filter(message => message.result), [{id: record.replayedRpcId, result: {decision: 'decline'}}]);
      await assert.rejects(hub.respond({id: fresh.id, decision: 'decline'}), /no longer pending/);
    } else {
      assert.equal(task.status, 'waiting'); assert.equal(hub.state.approvals.length, 0);
      assert.equal(writes.filter(message => message.result).length, 0);
    }
    assert.equal(writes.some(message => message.method === 'turn/start' || message.method === 'thread/resume'), false);
    return {passed: true, syntheticTransport: true, liveProviderProof: false, inputSource: record.source,
      recordedReplayPresent: record.replayedRpcId !== null,
      outcome: record.replayedRpcId === null ? 'no-replay-observed-remains-unverified' : 'recorded-replay-boundary-passed'};
  } finally { await hub.close(); }
}
if (require.main === module) {
  Promise.resolve().then(() => {
    if (process.argv.length !== 3) throw Error('Usage: npm run validate:approval-replay -- <redacted-observation.json>');
    const file = process.argv[2];
    if (fs.statSync(file).size > 4096) throw Error('Observation must be at most 4096 bytes.');
    return replay(JSON.parse(fs.readFileSync(file, 'utf8')));
  }).then(result => console.log(JSON.stringify(result, null, 2))).catch(() => {
    console.error('Replay failed: check the redacted schema and run the replay regression tests. Raw input is not logged.'); process.exitCode = 1;
  });
}
module.exports = {replay, validate};
