const test = require('node:test');
const assert = require('node:assert/strict');
const { load, actor, route, request, response } = require('./security-harness.cjs');
const tailwind = load('src/lib/tailwindBuilder.ts');
const access = load('src/lib/shared-project-access.ts');
const dto = load('src/lib/api/tenant-artifact-dto.ts', { '../tailwindBuilder': tailwind });
const sharedDto = load('src/lib/api/shared-artifact-dto.ts', {
  '../tailwindBuilder': tailwind, '../shared-project-access': access,
});

for (const [kind, file, entity, serializer, wrapped] of [
  ['module', 'modules/[id]/publish.ts', 'ModuleEntity', dto.serializeModule, false],
  ['UI', 'ui-entities/[id]/publish.ts', 'UIPackage', dto.serializeUiPackage, false],
  ['shared backend', 'admin/shared-modules/[id]/publish.ts', 'GlobalModulePackage', sharedDto.serializeSharedModulePackage, true],
  ['shared UI', 'admin/shared-packages/[id]/publish.ts', 'GlobalUIPackage', sharedDto.serializeSharedUiPackage, true],
]) {
  test(`${kind} publication returns the shared contract and snapshots the draft`, async () => {
    const record = { id: 'record-1', code: 'current-draft', codeBlob: 'draft-bundle', method: 'POST',
      publishedMethod: 'GET', routePath: '/current', name: 'orders', version: '1.0.0',
      fileExtension: 'js', dependencies: ['react'], ownerTeamId: 1 };
    Object.defineProperty(record, 'publishedCode', { get: () => record.publishedSourceCode?.code });
    const saved = [], invalidated = [], cssPublished = [];
    const user = actor('platform_admin');
    const handler = route(file, user, {
      '@/lib/api/tenant-artifact-dto': dto, '@/lib/api/shared-artifact-dto': sharedDto,
      '@/lib/shared-project-access': access, '@/lib/tailwindBuilder': tailwind,
      '@/lib/version': { generateVersion: () => 'published-test-version' },
      '@/lib/redis': { __esModule: true, default: { del: async (...keys) => invalidated.push(...keys) } },
      '@/lib/ui-entity-tailwind': { publishTailwindPackage: async (...args) => cssPublished.push(args) },
      '@/lib/shared-tailwind': { publishGlobalTailwindPackage: async (...args) => cssPublished.push(args) },
      '@/lib/core-db': { ensureCoreSchema: async () => {}, CoreDataSource: { getRepository: (name) => name === entity
        ? { findOne: async ({ where }) => {
          assert.equal(where.id, 'record-1');
          if (!wrapped) assert.deepEqual(where.tenant, { id: 'tenant-a' });
          return record;
        }, save: async (row) => { assert.equal(row, record); saved.push('artifact'); } }
        : { create: (value) => ({ ...value }), save: async (row) => { saved.push(row.code); } } } },
    });
    const res = response(); await handler(request('POST'), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, wrapped ? { package: serializer(record, user) } : serializer(record));
    assert.equal(record.publishedCode, 'current-draft'); assert.equal(record.publishedVersion, 'published-test-version');
    assert.equal(record.code, 'current-draft'); assert.ok(record.publishedAt instanceof Date);
    assert.deepEqual(saved, ['current-draft', 'artifact']);
    if (kind === 'module') {
      assert.equal(record.publishedMethod, 'POST'); assert.equal(record.publishedRoutePath, '/current');
      assert.ok(invalidated.includes('module:published:tenant-a:GET'));
      assert.ok(invalidated.includes('module:published:tenant-a:POST'));
    } else {
      assert.equal(record.publishedCodeBlob, 'draft-bundle'); assert.deepEqual(record.publishedDependencies, ['react']);
      if (kind.includes('UI')) { assert.equal(cssPublished.length, 1); assert.equal(invalidated.length, 2); }
    }
  });
}

for (const [kind, file, entity, revisionEntity, serializer, withTailwind] of [
  ['module', 'modules/[id]/rollback/[revisionId].ts', 'ModuleEntity', 'ModuleRevision', dto.serializeModule],
  ['UI', 'ui-entities/[id]/rollback/[revisionId].ts', 'UIPackage', 'UIPackageRevision', dto.serializeUiPackage],
  ['UI with Tailwind', 'ui-entities/[id]/rollback/[revisionId].ts', 'UIPackage', 'UIPackageRevision', dto.serializeUiPackage, true],
]) {
  test(`${kind} rollback restores the draft, records history and preserves the published snapshot`, async () => {
    const record = { id: 'record-1', code: 'current-draft', publishedCode: 'still-live', publishedVersion: 'live-1',
      routePath: '/same', method: 'GET', name: 'orders', version: '1.0.0', dependencies: [], fileExtension: 'js' };
    const previous = { ...record, id: 'revision-1', code: 'old-draft', codeBlob: 'old-bundle', dependencies: ['react'],
      fileExtension: kind === 'UI' ? 'css' : 'js' };
    const history = [], dependencies = [], cssPublished = [];
    const handler = route(file, actor('platform_admin'), {
      '@/lib/api/tenant-artifact-dto': dto,
      '@/lib/tailwindBuilder': { ...tailwind, buildTailwindCss: async () => 'rebuilt-css' },
      '@/lib/version': { generateVersion: () => 'rollback-draft-version' },
      '@/lib/tenant-npm-builds': { ensureTenantNpmBuilds: async (_tenant, deps) => dependencies.push(deps) },
      '@/lib/ui-entity-tailwind': { removeTailwindPackage: async () => {}, loadTailwindConfigForTenant: async () => null,
        upsertTailwindPackage: async (...args) => cssPublished.push(args) },
      '@/lib/core-db': { CoreDataSource: { getRepository: (name) => {
        if (name === entity) return { findOne: async () => record, save: async () => {} };
        assert.equal(name, revisionEntity);
        return { findOne: async ({ where, order }) => {
          if (order) return { revision: 2 };
          assert.equal(where.id, 'revision-1'); return previous;
        }, create: (value) => ({ ...value }), save: async (row) => history.push(row) };
      } } },
    });
    const req = request('POST'); req.query.revisionId = 'revision-1';
    const res = response(); await handler(req, res);
    assert.equal(res.statusCode, 200); assert.deepEqual(res.payload, serializer(record));
    assert.equal(record.code, 'old-draft'); assert.equal(record.draftVersion, 'rollback-draft-version');
    assert.equal(record.publishedCode, 'still-live'); assert.equal(record.publishedVersion, 'live-1');
    assert.equal(history.length, 1); assert.equal(history[0].code, 'current-draft');
    assert.equal(history[0].revision, 3); assert.equal(history[0].action, 'rollback');
    if (kind.startsWith('UI')) {
      assert.equal(record.codeBlob, 'old-bundle');
      assert.deepEqual(dependencies, [withTailwind ? ['react', 'orders__tw'] : ['react']]);
      assert.deepEqual(cssPublished, withTailwind ? [['tenant-a', 'orders__tw', '1.0.0', 'rebuilt-css']] : []);
    }
  });
}
