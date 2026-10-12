const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { load, route, actor, request, response, status } = require('./security-harness.cjs');
const { memoryRedis } = require('./assistant-test-runtime.cjs');
const fake = memoryRedis();
const control = load('src/lib/assistant/run-control.ts', { '@/lib/redis': { default: fake } });
const input = (runId, readOnly = false, tenantId = 'a') => ({
  runId,
  readOnly,
  tenantId,
  req: new EventEmitter(),
  res: new EventEmitter(),
});

test('only one writer may modify a tenant across users/chats; read-only and other tenants can run', async (t) => {
  const first = await control.createAssistantRunControl(input('chat-one'));
  t.after(() => first.dispose());
  await assert.rejects(
    control.createAssistantRunControl(input('chat-two')),
    (error) => error.code === 'assistant-busy',
  );
  const readonly = await control.createAssistantRunControl(input('inspect', true));
  const other = await control.createAssistantRunControl(input('other', false, 'b'));
  await readonly.dispose();
  await other.dispose();
  await first.dispose();
  const next = await control.createAssistantRunControl(input('next'));
  await next.dispose();
});
test('stop requests abort the worker before application; lease loss blocks writes and never deletes another owner', async () => {
  const stopped = await control.createAssistantRunControl(input('stop'));
  await control.requestAssistantStop('a', 'stop');
  await assert.rejects(stopped.assertOwnership(), (error) => error.code === 'assistant-stopped');
  await stopped.dispose();
  const lost = await control.createAssistantRunControl(input('lost'));
  fake.strings.set('assistant:writer:a', 'new-owner');
  await assert.rejects(lost.assertOwnership(), (error) => error.code === 'assistant-lease-lost');
  await lost.dispose();
  assert.equal(fake.strings.get('assistant:writer:a'), 'new-owner');
  fake.strings.delete('assistant:writer:a');
});
test('disconnect aborts execution, while a normal completed response does not', async () => {
  const firstInput = input('disconnect');
  const first = await control.createAssistantRunControl(firstInput);
  firstInput.res.emit('close');
  assert.equal(first.signal.reason.code, 'assistant-disconnected');
  await first.dispose();
  const normalInput = input('normal');
  const normal = await control.createAssistantRunControl(normalInput);
  normalInput.res.writableEnded = true;
  normalInput.res.emit('close');
  assert.equal(normal.signal.aborted, false);
  await normal.dispose();
});
const access = load('src/lib/assistant/run-access.ts');
const mocks = (summary, calls) => ({
  '@/lib/assistant/state-store': {
    getAssistantRunSummary: async () => summary,
    getAssistantRun: async () => null,
    deleteAssistantRun: async () => calls.push('delete'),
  },
  '@/lib/assistant/run-access': access,
  '@/lib/assistant/run-control': { requestAssistantStop: async () => calls.push('stop') },
  '@/lib/assistant/run-recovery': { recoverInterruptedRun: async () => null },
});
test('another user cannot retrieve, stop, or delete a run; legacy unknown owners stay admin-only', async () => {
  for (const file of ['assistant/runs/[runId].ts', 'assistant/runs/[runId]/stop.ts']) {
    for (const summary of [{ userId: '99', status: 'running' }, { status: 'running' }, null]) {
      const calls = [];
      const handler = route(file, actor(), mocks(summary, calls));
      const req = request(file.includes('/stop') ? 'POST' : 'GET');
      req.query.runId = 'private';
      await assert.rejects(handler(req, response()), status(404));
      assert.deepEqual(calls, []);
    }
  }
});
test('owned running status can be recovered and stopped, but deletion requires completion', async () => {
  const calls = [];
  const summary = { runId: 'owned', userId: '10', status: 'running' };
  const req = request('GET');
  req.query.runId = 'owned';
  const get = route('assistant/runs/[runId].ts', actor(), mocks(summary, calls));
  const res = response();
  await get(req, res);
  assert.equal(res.payload.pending, true);
  const del = response();
  await get({ ...req, method: 'DELETE' }, del);
  assert.equal(del.statusCode, 409);
  assert.deepEqual(calls, []);
  const stop = route('assistant/runs/[runId]/stop.ts', actor(), mocks(summary, calls));
  const stopped = response();
  await stop({ ...req, method: 'POST' }, stopped);
  assert.equal(stopped.payload.stopping, true);
  assert.deepEqual(calls, ['stop']);
});
test('cross-tenant access is rejected before reading run metadata', async () => {
  const get = route('assistant/runs/[runId].ts', actor(), {
    '@/lib/assistant/state-store': {
      getAssistantRunSummary: async () => assert.fail('must authorize tenant first'),
    },
  });
  const req = request('GET', 'b.example.test');
  req.query.runId = 'foreign';
  await assert.rejects(get(req, response()), status(403));
});

test('shared package writers are serialized across different tenants, and Stop releases every owned resource', async () => {
  const resource = 'assistant:shared-writer:module:common@1.0.0';
  const first = await control.createAssistantRunControl(input('shared-one', false, 'one'));
  const second = await control.createAssistantRunControl(input('shared-two', false, 'two'));
  try {
    await first.acquireResources([resource]);
    await assert.rejects(second.acquireResources([resource]), error => error.code === 'assistant-busy');
    await first.dispose();
    await second.acquireResources([resource]);
    await second.assertOwnership();
    assert.equal(fake.strings.get(resource), 'shared-two');
  } finally { await first.dispose(); await second.dispose(); }
  assert.equal(fake.strings.has(resource), false);
});
