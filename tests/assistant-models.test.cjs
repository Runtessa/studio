const test = require('node:test');
const assert = require('node:assert/strict');
const {
  load,
  route,
  actor,
  request,
  response,
} = require('./security-harness.cjs');

const catalog = (configured) =>
  load('src/lib/assistant/model-catalog.ts', {
    './gateway-runtime': {
      resolveCodexGatewayBaseForUser: async (id) => {
        assert.equal(id, 10);
        return { baseUrl: 'http://gateway.test' };
      },
    },
    './codex': { resolveCodexModelFromEnv: () => configured },
  });

test('catalog preserves the discovered default and explicit server model', async (t) => {
  const previous = global.fetch;
  t.after(() => {
    global.fetch = previous;
  });
  global.fetch = async (url) => {
    assert.match(url, /userId=10$/);
    return Response.json({
      data: [{ id: 'model-a' }, { id: 'model-b' }, { id: 'model-a' }],
      defaultModel: 'model-b',
    });
  };
  assert.deepEqual(await catalog().loadCodexModelCatalog(10), {
    models: ['model-a', 'model-b'],
    defaultModel: 'model-b',
  });
  assert.equal(
    (await catalog('server-model').loadCodexModelCatalog(10)).defaultModel,
    'server-model',
  );
});

test('offline, HTTP errors and empty catalogs never become successful fallback models', async (t) => {
  const previous = global.fetch;
  t.after(() => {
    global.fetch = previous;
  });
  global.fetch = async () => {
    throw Error('connection refused');
  };
  await assert.rejects(
    catalog().loadCodexModelCatalog(10),
    /Codex is unavailable/,
  );
  global.fetch = async () =>
    Response.json({ error: 'CLI unavailable' }, { status: 503 });
  await assert.rejects(catalog().loadCodexModelCatalog(10), /CLI unavailable/);
  global.fetch = async () => Response.json({ data: [] });
  await assert.rejects(
    catalog().loadCodexModelCatalog(10),
    /no available models/,
  );
});

test('model API returns a per-user catalog and explicit 503 on connection failure', async () => {
  const api = route('assistant/models.ts', actor(), {
    '@/lib/assistant/model-catalog': {
      loadCodexModelCatalog: async (id) => {
        assert.equal(id, 10);
        return { models: ['actual-model'], defaultModel: 'actual-model' };
      },
    },
  });
  const result = response();
  await api(request(), result);
  assert.deepEqual(result.payload, {
    models: ['actual-model'],
    defaultModel: 'actual-model',
  });
  const failing = route('assistant/models.ts', actor(), {
    '@/lib/assistant/model-catalog': {
      loadCodexModelCatalog: async () => {
        throw Error('Codex offline');
      },
    },
  });
  const failure = response();
  await failing(request(), failure);
  assert.equal(failure.statusCode, 503);
  assert.deepEqual(failure.payload, { models: [], error: 'Codex offline' });
});

test('config exposes the same Codex model and keeps policy server controlled', async () => {
  const api = route('assistant/config.ts', actor(), {
    '@/lib/assistant/model-catalog': {
      loadCodexModelCatalog: async () => ({
        models: ['actual-model'],
        defaultModel: 'actual-model',
      }),
    },
    '@/lib/assistant/codex': {
      CODEX_SYSTEM_INSTRUCTIONS: 'server policy',
      resolveCodexModelFromEnv: () => undefined,
    },
    '@/lib/assistant/gateway': {
      resolveCodexGatewayBase: () => 'http://gateway.test',
      resolveCodexGatewayProvider: () => 'codex-gateway',
    },
  });
  const result = response();
  await api(request(), result);
  assert.equal(result.payload.agentType, 'codex');
  assert.equal(result.payload.model, 'actual-model');
  assert.equal(result.payload.profile.model, 'actual-model');
  assert.equal(result.payload.connectionError, '');
  assert.equal(result.payload.systemPrompt, 'server policy');
});
