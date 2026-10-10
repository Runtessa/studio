const test = require('node:test');
const assert = require('node:assert/strict');
const { load, actor, permissions, tenant, status } = require('./security-harness.cjs');
const sharedAccess = load('src/lib/shared-project-access.ts');
const ctx = (role = 'backend_developer') => ({ ...actor(role), tenant, changes: [] });
const change = (kind = 'module', action = 'update', id = 'record-1') => ({
  kind, action, before: { id }, after: { id },
});
const setup = (findOne) => load('src/lib/assistant/rollback-access.ts', {
  '../core-db': { CoreDataSource: { getRepository: (entity) => ({ findOne: (options) => findOne(entity, options.where) }) } },
  '../tenant-permissions': permissions,
  '../shared-project-access': sharedAccess,
});
test('observer cannot roll back code, models, UI, ACL or shared projects', async () => {
  const access = setup(() => { throw new Error('Unauthorized rollback reached storage'); });
  for (const kind of ['module', 'model', 'ui', 'acl', 'shared-project', 'shared-file']) {
    const input = kind === 'acl' ? { kind, action: 'update', file: 'permissions' }
      : { ...change(kind), projectId: 'project-1', projectKind: 'ui', before: { id: 'record-1', kind: 'ui' } };
    await assert.rejects(access.assertRollbackAccess([input], ctx('observer')), status(403));
  }
});
test('foreign tenant ID is rejected even when developer can write own tenant', async () => {
  const seen = [];
  const access = setup((entity, where) => { seen.push(where); return null; });
  await assert.rejects(access.assertRollbackAccess([change()], ctx()), status(404));
  assert.deepEqual(seen, [{ id: 'record-1', tenant: { id: 'tenant-a' } }]);
});
test('restoring a deleted snapshot cannot overwrite an existing ID in any tenant', async () => {
  const access = setup(() => ({ id: 'record-1', tenant: { id: 'tenant-b' } }));
  await assert.rejects(access.assertRollbackAccess([change('module', 'delete')], ctx()), status(409));
});
test('allowed module update and truly deleted module restore remain usable', async () => {
  await setup(() => ({ id: 'record-1' })).assertRollbackAccess([change()], ctx());
  await setup(() => null).assertRollbackAccess([change('module', 'delete')], ctx());
});
test('shared rollback requires owning or granted team and checks file-to-project relation', async () => {
  const input = { ...change('shared-file'), projectId: 'project-1', projectKind: 'ui' };
  const denied = setup(() => ({ id: 'project-1', ownerTeamId: 2, editorTeamIds: [] }));
  await assert.rejects(denied.assertRollbackAccess([input], ctx('frontend_developer')), status(403));
  const seen = [];
  const allowed = setup((entity, where) => {
    seen.push(where);
    return entity === 'GlobalUIPackage' ? { ownerTeamId: 1, editorTeamIds: [] } : { id: 'record-1' };
  });
  await allowed.assertRollbackAccess([input], ctx('frontend_developer'));
  assert.deepEqual(seen[1], { id: 'record-1', project: { id: 'project-1' } });
});
test('malformed rollback kinds and ACL files fail closed', async () => {
  const access = setup(() => null);
  for (const input of [null, change('user'), { kind: 'acl', action: 'update', file: 'unknown' }, change('module', 'update', '')]) {
    await assert.rejects(access.assertRollbackAccess([input], ctx('tenant_admin')), status(400));
  }
});
test('rollback execution validates the complete batch before any mutation', async () => {
  let writes = 0;
  const core = {
    ensureCoreSchema: async () => {},
    CoreDataSource: { getRepository: () => ({
      findOne: async ({ where }) => where.id === 'own' ? { id: 'own' } : null,
      save: async () => { writes++; }, remove: async () => { writes++; }, create: () => { writes++; },
    }) },
  };
  const access = load('src/lib/assistant/rollback-access.ts', {
    '../core-db': core, '../tenant-permissions': permissions, '../shared-project-access': sharedAccess,
  });
  const rollback = load('src/lib/assistant/toolRollback.ts', {
    './rollback-access': access, '@/lib/core-db': core,
  });
  await assert.rejects(rollback.rollbackChanges([change('module', 'create', 'own'), change('module', 'create', 'foreign')], ctx()), status(404));
  assert.equal(writes, 0);
});
test('restored module uses insert and copies only snapshot fields, never ownership or publication overrides', async () => {
  let inserted;
  const core = {
    ensureCoreSchema: async () => {},
    CoreDataSource: { getRepository: (entity) => ({
      findOne: async () => null,
      create: (value) => ({ ...value, id: value.id || 'source-1' }),
      save: async () => { if (entity === 'ModuleEntity') throw new Error('Restore must never upsert an existing ID'); },
      insert: async (value) => { inserted = value; },
    }) },
  };
  const access = load('src/lib/assistant/rollback-access.ts', {
    '../core-db': core, '../tenant-permissions': permissions, '../shared-project-access': sharedAccess,
  });
  const rollback = load('src/lib/assistant/toolRollback.ts', {
    './rollback-access': access, '@/lib/core-db': core,
    './workspaceOps': { ensureAclEndpoint: async () => {} },
    '@/lib/version': { generateVersion: () => 'next' },
  });
  await rollback.rollbackChanges([{
    kind: 'module', action: 'delete', before: {
      id: 'deleted', routePath: '/reports', method: 'GET', code: 'code',
      tenant: { id: 'tenant-b' }, publishedCode: 'unauthorized publication',
    },
  }], ctx());
  assert.equal(inserted.tenant.id, 'tenant-a');
  assert.equal(inserted.publishedCode, undefined);
  assert.equal(inserted.routePath, '/reports');
});
test('a batch can restore a deleted model before undoing its earlier update', async () => {
  await setup(() => null).assertRollbackAccess([
    change('model', 'update'), change('model', 'delete'),
  ], ctx('model_developer'));
});
test('a batch can remove a recreated model before restoring the original deletion', async () => {
  await setup(() => ({ id: 'record-1' })).assertRollbackAccess([
    change('model', 'delete'), change('model', 'create'),
  ], ctx('model_developer'));
});
