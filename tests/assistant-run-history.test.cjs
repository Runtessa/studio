const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { load } = require('./security-harness.cjs');
const { memoryRedis } = require('./assistant-test-runtime.cjs');
const fake = memoryRedis();
const state = load('src/lib/assistant/state-store.ts', { crypto, '@/lib/redis': { default: fake } });
const runs = load('src/lib/assistant/respond-runtime/run-normalization.ts', { 'node:crypto': crypto });
const complete = async (id, userId, chatId) => {
  await state.startAssistantRun('tenant', id, { userId, chatId, runName: id });
  await state.completeAssistantRun({
    tenantId: 'tenant',
    runId: id,
    userId,
    chatId,
    runName: id,
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: id,
    events: [],
    changes: [],
    artifacts: [],
    conflicts: [],
    dag: { nodes: [], edges: [] },
  });
};
test('turns in the same chat get distinct run IDs and names reflect the latest user request', () => {
  const ids = new Set(Array.from({ length: 100 }, () => runs.createRunId('same-chat')));
  assert.equal(ids.size, 100);
  assert.equal(
    runs.buildRunName([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second' },
    ]),
    'second',
  );
});
test('idempotency is scoped to user/chat/request and a retry nonce survives context changes', () => {
  const messages = [{ role: 'user', content: 'inspect' }];
  const key = (identity) => state.buildAssistantIdempotencyKey(messages, 'old context', identity);
  const identity = { userId: 1, chatId: 'c', requestId: 'r' };
  assert.equal(key(identity), state.buildAssistantIdempotencyKey(messages, 'updated context', identity));
  for (const changed of [
    { ...identity, userId: 2 },
    { ...identity, chatId: 'd' },
    { ...identity, requestId: 'r2' },
  ])
    assert.notEqual(key(identity), key(changed));
});
test('separate turn history preserves older runs and latest context belongs to its user and chat', async () => {
  await complete('first', '1', 'chat');
  await complete('second', '1', 'chat');
  await complete('foreign', '2', 'chat');
  assert.equal((await state.getAssistantRun('tenant', 'first')).message, 'first');
  assert.equal((await state.getLatestAssistantRun('tenant', '1', 'chat')).message, 'second');
  assert.equal((await state.getLatestAssistantRun('tenant', '2', 'chat')).message, 'foreign');
  assert.equal(await state.getLatestAssistantRun('tenant', '1', 'other-chat'), null);
  assert.equal((await state.getAssistantRunSummary('tenant', 'second')).userId, '1');
  assert.deepEqual(
    (await state.listAssistantRuns('tenant', { userId: '1', limit: 1, offset: 1 })).map((run) => run.runId),
    ['first'],
  );
});
test('interrupted worker recovery retains its checkpoint; active or recently starting workers are not marked failed', async () => {
  const recovery = load('src/lib/assistant/run-recovery.ts', {
    '@/lib/redis': { default: fake },
    './run-control': { activeRunKey: (tenant, run) => `active:${tenant}:${run}` },
    './state-store': state,
  });
  const summary = {
    runId: 'interrupted',
    userId: '1',
    chatId: 'chat',
    status: 'running',
    createdAt: new Date(Date.now() - 120000).toISOString(),
  };
  const changes = [{ kind: 'module', action: 'update', after: { id: 'saved' } }];
  await state.startAssistantRun('tenant', summary.runId, { userId: '1', chatId: 'chat' });
  await state.checkpointAssistantChanges('tenant', summary.runId, changes);
  fake.strings.set('active:tenant:interrupted', 'interrupted');
  assert.equal(await recovery.recoverInterruptedRun('tenant', summary), null);
  fake.strings.delete('active:tenant:interrupted');
  assert.equal(
    await recovery.recoverInterruptedRun('tenant', { ...summary, createdAt: new Date().toISOString() }),
    null,
  );
  const result = await recovery.recoverInterruptedRun('tenant', summary);
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.changes, changes);
  assert.equal(
    (await state.getAssistantRun('tenant', summary.runId)).finishReason,
    'assistant-worker-interrupted',
  );
});
