const test = require('node:test');
const assert = require('node:assert/strict');
const { actor, load, route, permissions, response, request, status } = require('./security-harness.cjs');
const sharedAccess = load('src/lib/shared-project-access.ts');
const itemsGuard = (project) => load('src/lib/publish-request-access.ts', {
  './core-db': { CoreDataSource: { getRepository: () => ({ findOne: async () => project }) } },
  './tenant-permissions': permissions, './shared-project-access': sharedAccess,
});
for (const [file, method] of [
  ['admin/publish-requests/[id].ts', 'GET'],
  ['publish-requests/[id]/approve.ts', 'POST'], ['publish-requests/[id]/reject.ts', 'POST'],
]) {
  test(`${file} cannot expose or act on another team's request by ID`, async () => {
    const res = response();
    const handler = route(file, actor('tenant_admin'), {
      '@/lib/core-db': { ensureCoreSchema: async () => {}, CoreDataSource: { getRepository: () => ({ findOne: async () => ({ tenant: { id: 'tenant-b' } }) }) } },
      '@/lib/core-users': { ensureCoreUserIdentity: async () => ({ id: 10 }) },
    });
    await assert.rejects(handler(request(method), res), status(403));
    assert.equal(res.payload, undefined);
  });
}
test('explicit tenantId cannot bypass membership in publication list', async () => {
  const req = request(); req.query.tenantId = 'tenant-b';
  const handler = route('admin/publish-requests.ts', actor('tenant_admin'), {
    '@/lib/core-db': { ensureCoreSchema: async () => {} },
  });
  await assert.rejects(handler(req, response()), status(403));
});
test('publication list propagates denied header selection; does not turn it into an all-tenant query', async () => {
  const handler = route('admin/publish-requests.ts', actor('tenant_admin'), {
    '@/lib/core-db': { ensureCoreSchema: async () => {} },
  });
  await assert.rejects(handler(request('GET', 'b.example.test'), response()), status(403));
});
test('frontend publisher cannot publish backend modules indirectly', async () => {
  await assert.rejects(itemsGuard(null).assertPublishRequestItems(actor('frontend_developer'), [{ kind: 'module', id: 'm' }]), status(403));
});
test('shared publication requires resource permission and owner team', async () => {
  const input = [{ kind: 'shared', sharedType: 'backend', id: 'shared' }];
  await assert.rejects(itemsGuard({ ownerTeamId: 2 }).assertPublishRequestItems(actor('tenant_admin'), input), status(403));
  await itemsGuard({ ownerTeamId: 1 }).assertPublishRequestItems(actor('tenant_admin'), input);
  await itemsGuard({ ownerTeamId: 2 }).assertPublishRequestItems(actor('platform_admin'), input);
});
test('ordinary collaborator cannot submit another team shared draft for publication', async () => {
  const handler = route('publish-requests/index.ts', actor('tenant_admin'), {
    '@/lib/core-db': { ensureCoreSchema: async () => {}, CoreDataSource: { getRepository: () => ({ findOne: async () => ({ ownerTeamId: 2, editorTeamIds: [] }) }) } },
    '@/lib/core-users': { ensureCoreUserIdentity: async () => ({ id: 10 }) },
    '@/lib/shared-project-access': sharedAccess,
  });
  await assert.rejects(handler(request('POST', 'a.example.test', { comment: 'publish', itemIds: ['shared-project-1'] }), response()), status(403));
});
