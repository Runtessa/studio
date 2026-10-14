const test = require('node:test');
const assert = require('node:assert/strict');
const { route, actor, response } = require('./security-harness.cjs');

test('assistant login routes sign the authenticated actor and ignore body-supplied user identities', async () => {
  for (const [file, method] of [['start.ts', 'POST'], ['login.ts', 'POST'], ['logout.ts', 'POST'],
    ['callback.ts', 'POST'], ['status.ts', 'GET'], ['session/[sessionId].ts', 'GET']]) {
    let sent = false;
    const api = route(`assistant/auth/${file}`, actor(), {
      '@/lib/assistant/gateway-runtime': { resolveCodexGatewayBaseForUser: async (id) => {
        assert.equal(id, '10'); return { baseUrl: 'http://gateway.test' };
      } },
      '@/lib/assistant/gateway-fetch': { fetchCodexGateway: async (_url, identity, init) => {
        sent = true; assert.deepEqual(identity, { userId: 10 });
        if (init?.body) assert.notEqual(JSON.parse(init.body).userId, 'other-user');
        return Response.json({ ok: true });
      } },
    });
    const res = response();
    await api({ method, headers: { host: 'studio.test' }, query: { sessionId: 'session' },
      body: { userId: 'other-user', sessionId: 'session' } }, res);
    assert.equal(sent, true); assert.equal(res.statusCode, 200);
  }
});

test('unauthenticated login requests never reach the gateway', async () => {
  let sent = false;
  const api = route('assistant/auth/start.ts', actor(), {
    '@/lib/auth': { requireUser: async () => { throw Object.assign(new Error('Unauthorized'), { statusCode: 401 }); } },
    '@/lib/assistant/gateway-fetch': { fetchCodexGateway: () => { sent = true; } },
  });
  await assert.rejects(api({ method: 'POST', headers: {}, body: {} }, response()), { statusCode: 401 });
  assert.equal(sent, false);
});
