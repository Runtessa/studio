const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const blocked = () => { throw new Error('Unexpected dependency call before authorization'); };
const unused = new Proxy({ __esModule: true }, { get: (_, key) => key === '__esModule' ? true : blocked });
const entities = new Proxy({}, { get: (_, key) => key });
const load = (file, mocks = {}) => {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  const resolve = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id === '@idp/shared') return entities;
    return unused;
  };
  new Function('require', 'module', 'exports', code)(resolve, module, module.exports);
  return module.exports;
};
const rbac = load('src/lib/rbac.ts');
const permissions = load('src/lib/tenant-permissions.ts');
const actor = (role = 'backend_developer', team = 1) => ({
  id: 10, email: 'developer@example.test', normalizedRole: role, role,
  activeTeamId: team, isAdmin: role === 'admin' || role === 'platform_admin',
  permissions: rbac.getRolePermissions(role),
});
const scope = load('src/lib/team-tenant-access.ts', {
  './db': {
    ensureSchema: async () => {},
    AppDataSource: { getRepository: () => ({ find: async ({ where }) => where.teamId === 1 ? [{ tenantId: 'tenant-a' }] : [] }) },
  },
});
const response = () => ({
  statusCode: 200, payload: undefined,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.payload = body; return this; },
  end() {}, setHeader() {},
});
const tenant = { id: 'tenant-a', hostname: 'a.example.test', isSuspended: false };
const tenancy = load('src/lib/tenancy.ts', {
  './core-db': {
    ensureCoreSchema: async () => {},
    CoreDataSource: { getRepository: () => ({ findOne: async ({ where }) =>
      where.hostname === 'missing.example.test' ? null : {
        ...tenant, id: where.hostname === 'b.example.test' ? 'tenant-b' : 'tenant-a',
        isSuspended: where.hostname === 'suspended.example.test',
      } }) },
  },
  './team-tenant-access': scope,
  './tenant-permissions': permissions,
});
const route = (file, user, additional = {}) => load(`src/pages/api/${file}`, {
  '@/lib/api-helpers': { withApiHandler: (handler) => handler },
  '@/lib/auth': { requireUser: async () => user, requireAdmin: async () => user },
  '@/lib/tenancy': tenancy,
  '@/lib/team-tenant-access': scope,
  '@/lib/tenant-permissions': permissions,
  ...additional,
}).default;
const request = (method = 'GET', host = 'a.example.test', body = {}) => ({
  method, headers: { 'x-tenant-host': host }, query: { id: 'record-1' }, body,
});
const status = (expected) => (error) => error.statusCode === expected;
module.exports = { load, actor, scope, permissions, tenancy, route, response, request, status, tenant, rbac };
