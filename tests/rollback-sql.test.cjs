require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource, getMetadataArgsStorage } = require('typeorm');
const shared = require('@idp/shared');
const { load, actor, permissions, tenant } = require('./security-harness.cjs');

// Use real entity metadata and SQL generation; never connect to a database.
test('restored module, model and UI produce inserts with the authorized tenant and saved code relations', async () => {
  const ds = new DataSource({ type: 'postgres', entities: getMetadataArgsStorage().tables.map((table) => table.target) });
  await ds.buildMetadatas();
  const inserts = [];
  const core = {
    ensureCoreSchema: async () => {},
    CoreDataSource: { getRepository: (name) => {
      const repo = ds.getRepository(shared[name]);
      return {
        create: (value) => repo.create(value),
        findOne: async () => null,
        find: async () => [],
        save: async (value) => {
          assert.ok(['SourceCode', 'CompiledCode'].includes(name));
          value.id = randomUUID(); return value;
        },
        insert: async (value) => {
          const [sql, parameters] = repo.createQueryBuilder().insert().values(value).getQueryAndParameters();
          inserts.push({ name, sql, parameters, value });
        },
      };
    } },
  };
  const access = load('src/lib/assistant/rollback-access.ts', {
    '../core-db': core, '../tenant-permissions': permissions,
    '../shared-project-access': load('src/lib/shared-project-access.ts'),
  });
  const rollback = load('src/lib/assistant/toolRollback.ts', {
    './rollback-access': access, '@/lib/core-db': core,
    '@/lib/version': { generateVersion: () => 'next' },
    './workspaceOps': { ensureAclEndpoint: async () => {} },
    '@/lib/orm-compiler': { compileOrmSource: () => 'compiled' },
    '@/lib/ui-entity-tailwind': { rebuildTailwindPackagesForTenant: async () => {}, clearRegistryCache: async () => {} },
  });
  const changes = [
    { kind: 'module', action: 'delete', before: { id: randomUUID(), routePath: '/reports', method: 'GET', code: 'source', fileExtension: 'js' } },
    { kind: 'model', action: 'delete', before: { id: randomUUID(), path: 'models/account.js', code: 'source', fileExtension: 'js' } },
    { kind: 'ui', action: 'delete', before: { id: randomUUID(), name: 'dashboard', version: '1.0.0', code: 'source', codeBlob: 'compiled', dependencies: [], fileExtension: 'jsx' } },
  ];
  await rollback.rollbackChanges(changes, { ...actor('tenant_admin'), tenant, changes: [] });
  assert.equal(inserts.length, 3);
  for (const insert of inserts) {
    assert.match(insert.sql, /^INSERT INTO /);
    assert.doesNotMatch(insert.sql, /ON CONFLICT|UPDATE SET/);
    assert.ok(insert.parameters.includes(tenant.id));
    assert.equal(insert.value.tenant.id, tenant.id);
    assert.ok(insert.parameters.includes(insert.value.sourceCode.id));
    assert.notEqual(insert.value.sourceCode.id, undefined);
  }
});
