const test = require('node:test');
const assert = require('node:assert/strict');
const { actor, scope, permissions, tenancy, route, response, request, status } = require('./security-harness.cjs');

const endpoints = [
  ['models/index.ts', 'GET'], ['models/index.ts', 'POST'],
  ['models/[id].ts', 'GET'], ['models/[id].ts', 'PUT'], ['models/[id].ts', 'DELETE'],
  ['models/migrate.ts', 'POST'],
  ['modules/index.ts', 'GET'], ['modules/index.ts', 'POST'],
  ['modules/[id].ts', 'GET'], ['modules/[id].ts', 'PUT'], ['modules/[id].ts', 'DELETE'],
  ['modules/[id]/publish.ts', 'POST'], ['modules/[id]/versions.ts', 'GET'],
  ['modules/[id]/rollback/[revisionId].ts', 'POST'],
  ['ui-entities/index.ts', 'GET'], ['ui-entities/index.ts', 'POST'],
  ['ui-entities/[id].ts', 'GET'], ['ui-entities/[id].ts', 'PUT'], ['ui-entities/[id].ts', 'DELETE'],
  ['ui-entities/[id]/publish.ts', 'POST'], ['ui-entities/[id]/versions.ts', 'GET'],
  ['ui-entities/[id]/rollback/[revisionId].ts', 'POST'],
  ['acl/config.ts', 'GET'], ['acl/config.ts', 'PUT'],
  ['assistant/runs.ts', 'GET'], ['assistant/runs/[runId].ts', 'GET'],
  ['assistant/runs/[runId].ts', 'DELETE'], ['assistant/preview/exceptions.ts', 'POST'],
  ['assistant/respond.ts', 'POST'], ['assistant/workspace/activate.ts', 'POST'],
  ['assistant/tenant-dump.ts', 'GET'], ['assistant/rollback.ts', 'POST'],
  ['publish-requests/index.ts', 'POST'],
];
for (const [file, method] of endpoints) {
  test(`${method} ${file} rejects another team's tenant before resource access`, async () => {
    await assert.rejects(route(file, actor('tenant_admin'))(request(method, 'b.example.test'), response()), status(403));
  });
}
for (const [file, method] of endpoints.filter(([file, method]) => method !== 'GET' && /^(models|modules|ui-entities|acl)\//.test(file))) {
  test(`observer cannot mutate ${file} using ${method}`, async () => {
    await assert.rejects(route(file, actor('observer'))(request(method), response()), status(403));
  });
}
test('assigned developer reads model list; no global tenant management permission needed', async () => {
  const res = response();
  const handler = route('models/index.ts', actor('model_developer'), {
    '@/lib/core-db': { CoreDataSource: { getRepository: () => ({ find: async (options) => {
      assert.equal(options.where.tenant.id, 'tenant-a'); return [];
    } }) } },
  });
  await handler(request(), res);
  assert.equal(res.statusCode, 200); assert.deepEqual(res.payload, []);
});
test('frontend developer cannot edit models; model developer cannot publish UI', async () => {
  await assert.rejects(route('models/[id].ts', actor('frontend_developer'))(request('PUT'), response()), status(403));
  await assert.rejects(route('ui-entities/[id]/publish.ts', actor('model_developer'))(request('POST'), response()), status(403));
});
test('tenant selection rejects missing user, absent team, unknown tenant, suspended tenant and duplicate headers', async () => {
  await assert.rejects(tenancy.resolveTenant(request(), null), status(401));
  await assert.rejects(tenancy.resolveTenant(request(), actor('user', null)), status(403));
  await assert.rejects(tenancy.resolveTenant(request('GET', 'missing.example.test'), actor()), status(404));
  await assert.rejects(tenancy.resolveTenant(request('GET', 'suspended.example.test'), actor()), status(403));
  const duplicate = request(); duplicate.headers['x-tenant-host'] = ['a.example.test', 'b.example.test'];
  await assert.rejects(tenancy.resolveTenant(duplicate, actor()), status(400));
});
test('header selection and development fallback both enforce membership', async () => {
  const previous = process.env.DEV_TENANT_HOST;
  try {
    process.env.DEV_TENANT_HOST = 'b.example.test';
    await assert.rejects(tenancy.resolveTenant({ headers: {} }, actor()), status(403));
    const own = await tenancy.resolveTenant(request('GET', ' A.EXAMPLE.TEST '), actor());
    assert.equal(own.id, 'tenant-a');
  } finally {
    if (previous === undefined) delete process.env.DEV_TENANT_HOST; else process.env.DEV_TENANT_HOST = previous;
  }
});
test('platform admin can select another tenant; stale role string cannot override explicit permissions', async () => {
  const selected = await tenancy.resolveTenant(request('GET', 'b.example.test'), actor('platform_admin'), 'ide.models.write');
  assert.equal(selected.id, 'tenant-b');
  assert.throws(() => permissions.assertIdePermissions({ ...actor('tenant_admin'), permissions: [] }, 'ide.models.write'), status(403));
  await assert.rejects(scope.assertTenantReadableForUser(actor('tenant_admin', 2), 'tenant-a'), status(403));
});
test('model developer can create a model within assigned tenant', async () => {
  let saved;
  const handler = route('models/index.ts', actor('model_developer'), {
    '@/lib/core-db': { CoreDataSource: { getRepository: () => ({
      findOne: async () => null, create: (value) => ({ id: 'new-model', ...value }),
      save: async (value) => { saved = value; },
    }) } },
    '@/lib/orm-compiler': { compileOrmSource: () => 'compiled' },
    '@/lib/version': { generateVersion: () => 'next' },
  });
  const res = response();
  await handler(request('POST', 'a.example.test', { path: 'models/account.js', code: 'model source' }), res);
  assert.equal(res.statusCode, 201); assert.equal(saved.tenant.id, 'tenant-a');
});
