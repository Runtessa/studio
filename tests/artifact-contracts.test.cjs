const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { load, actor, route, request, response } = require('./security-harness.cjs');

const tailwind = load('src/lib/tailwindBuilder.ts');
const sharedAccess = load('src/lib/shared-project-access.ts');
const tenantDto = load('src/lib/api/tenant-artifact-dto.ts', { '../tailwindBuilder': tailwind });
const sharedDto = load('src/lib/api/shared-artifact-dto.ts', {
  '../tailwindBuilder': tailwind, '../shared-project-access': sharedAccess,
});
const css = load('src/lib/shared-build/css-module-source.ts');
const timestamp = new Date('2026-01-01T00:00:00.000Z');

test('module response keeps draft and published code separate and omits unpublished fields', () => {
  const record = { id: 'module-1', routePath: '/hello', method: 'GET', code: 'draft',
    fileExtension: 'js', draftVersion: 'draft-2', publishedVersion: null, tenant: { id: 'tenant-a' },
    publishedCode: null, createdAt: timestamp, updatedAt: timestamp };
  const draft = tenantDto.serializeModule(record);
  assert.equal(draft.code, 'draft');
  assert.equal(draft.createdAt, timestamp);
  assert.equal(draft.publishedCode, undefined);
  assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(draft)), 'publishedCode'), false);
  assert.equal(Object.hasOwn(draft, 'tenant'), false);
  const published = tenantDto.serializeModule({ ...record, publishedCode: 'live',
    publishedVersion: 'published-1', publishedRoutePath: '/old', publishedMethod: 'POST' });
  assert.equal(published.code, 'draft');
  assert.equal(published.publishedCode, 'live');
  assert.equal(published.publishedRoutePath, '/old');
  assert.equal(published.publishedMethod, 'POST');
});

test('UI responses strip generated Tailwind dependencies without changing stored arrays', () => {
  const record = { name: '@app/orders', code: 'draft', codeBlob: 'draft bundle',
    dependencies: ['react', '@app/orders__tw', 'helper'], publishedCode: 'live',
    publishedCodeBlob: 'live bundle', publishedDependencies: ['@app/orders__tw', 'live-helper'] };
  const dto = tenantDto.serializeUiPackage(record);
  assert.deepEqual(dto.dependencies, ['react', 'helper']);
  assert.deepEqual(dto.publishedDependencies, ['live-helper']);
  assert.equal(dto.codeBlob, 'draft bundle');
  assert.equal(dto.publishedCodeBlob, 'live bundle');
  assert.deepEqual(record.dependencies, ['react', '@app/orders__tw', 'helper']);
  assert.deepEqual(tenantDto.serializeUiPackage({ name: 'empty' }).dependencies, []);
});

for (const [name, serialize] of Object.entries(sharedDto)) {
  test(`${name} preserves owner/editor/publication access distinctions`, () => {
    const record = { name: 'shared-ui', code: 'draft', ownerTeamId: 1,
      editorTeamIds: [3, 2, 1, 2], dependencies: ['shared-ui__tw', 'helper'] };
    const owner = serialize(record, actor('tenant_admin', 1));
    assert.equal(owner.canEdit, true); assert.equal(owner.canPublish, true);
    assert.equal(owner.canManageAccess, true); assert.equal(owner.ownerTeamId, 1);
    assert.deepEqual(owner.editorTeamIds, [2, 3]);
    const editor = serialize(record, actor('frontend_developer', 2));
    assert.equal(editor.canEdit, true); assert.equal(editor.canPublish, false);
    assert.equal(editor.canManageAccess, false);
    const foreign = serialize(record, actor('tenant_admin', 4));
    assert.equal(foreign.canEdit, false); assert.equal(foreign.canPublish, false);
    assert.equal(foreign.canManageAccess, false);
    const admin = serialize(record, actor('platform_admin', 4));
    assert.equal(admin.canEdit, true); assert.equal(admin.canPublish, true);
    assert.equal(Object.hasOwn(owner, 'publishedCode'), false);
    assert.deepEqual(record.editorTeamIds, [3, 2, 1, 2]);
    assert.deepEqual(owner.dependencies, name === 'serializeSharedUiPackage'
      ? ['helper'] : ['shared-ui__tw', 'helper']);
  });
}

for (const [kind, file, serialize, fields] of [
  ['module', 'modules/[id].ts', tenantDto.serializeModule, { routePath: '/hello', method: 'GET' }],
  ['UI', 'ui-entities/[id].ts', tenantDto.serializeUiPackage, { name: '@app/orders' }],
]) {
  test(`${kind} authorized read uses the shared response contract and tenant-scoped query`, async () => {
    const record = { id: 'record-1', code: 'draft', publishedCode: 'live', ...fields };
    const handler = route(file, actor('tenant_admin'), {
      '@/lib/api/tenant-artifact-dto': tenantDto,
      '@/lib/core-db': { CoreDataSource: { getRepository: () => ({ findOne: async ({ where }) => {
        assert.deepEqual(where, { id: 'record-1', tenant: { id: 'tenant-a' } });
        return record;
      } }) } },
    });
    const res = response(); await handler(request(), res);
    assert.equal(res.statusCode, 200); assert.deepEqual(res.payload, serialize(record));
  });
}

test('CSS module supports server execution, quoted paths and repeated browser updates', () => {
  const path = 'src/quoted"style.css';
  const styleText = 'body::after { content: "hello\\world"; }\n/* فارسی */';
  const generated = css.buildCssModuleSource(path, styleText);
  const server = { module: { exports: {} } };
  vm.runInNewContext(generated, server);
  assert.equal(server.module.exports, styleText);
  const styles = [];
  const document = {
    querySelectorAll: (selector) => { assert.equal(selector, 'style[data-shared-style]'); return styles; },
    createElement: () => ({ textContent: '', setAttribute(key, value) { this[key] = value; },
      getAttribute(key) { return this[key] || null; } }),
    head: { appendChild(style) { styles.push(style); } },
  };
  vm.runInNewContext(generated, { document, module: { exports: {} } });
  assert.equal(styles.length, 1); assert.equal(styles[0].textContent, styleText);
  assert.equal(styles[0]['data-shared-style'], `shared-style:${path}`);
  vm.runInNewContext(css.buildCssModuleSource(path, 'updated'), { document, module: { exports: {} } });
  assert.equal(styles.length, 1); assert.equal(styles[0].textContent, 'updated');
  vm.runInNewContext(css.buildCssModuleSource('other/style.css', 'other'), { document, module: { exports: {} } });
  assert.equal(styles.length, 2); assert.equal(styles[0].textContent, 'updated');
  assert.equal(styles[1].textContent, 'other');
});
