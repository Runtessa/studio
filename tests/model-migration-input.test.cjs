const test = require("node:test");
const assert = require("node:assert/strict");
const { load, response } = require("./security-harness.cjs");

test("model migration loads relational source and compiled code with the canonical write secret", async () => {
  let sources;
  const models = {
    find: async (options) => {
      assert.deepEqual(options.relations, ["sourceCode", "compiledCode"]);
      return [
        {
          path: "models/Task.js",
          fileExtension: "js",
          sourceCode: { code: "source entity" },
          compiledCode: { code: "compiled entity" },
          get code() {
            return this.sourceCode.code;
          },
          get codeBlob() {
            return this.compiledCode.code;
          },
        },
      ];
    },
  };
  const secrets = {
    findOne: async (options) => {
      assert.equal(
        options.where.keyName,
        "adapter:postgres:taskflow:default:write",
      );
      return { encryptedValue: "fixture" };
    },
  };
  const handler = load("src/pages/api/models/migrate.ts", {
    "@/lib/api-helpers": { withApiHandler: (handler) => handler },
    "@/lib/auth": { requireUser: async () => ({ id: 1 }) },
    "@/lib/tenancy": {
      resolveTenant: async () => ({
        id: "tenant",
        adapterAccess: { postgres: { allow: ["taskflow"] } },
      }),
    },
    "@/lib/core-db": {
      ensureCoreSchema: async () => {},
      CoreDataSource: {
        getRepository: (entity) => (entity === "OrmModel" ? models : secrets),
      },
    },
    "@/lib/crypto": {
      decryptSecret: () =>
        JSON.stringify({
          host: "localhost",
          database: "fixture",
          user: "fixture",
        }),
    },
    "@/lib/adapter-config-passwords": {
      decryptPasswordFields: (config) => config,
    },
    "@/lib/orm-migration": {
      migrateOrmModels: async (input) => {
        sources = input;
        return { migrated: true };
      },
    },
  }).default;
  const res = response();
  await handler(
    { method: "POST", body: { adapterKey: "postgres:taskflow" } },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(sources, [
    { path: "models/Task.js", code: "compiled entity" },
  ]);
});

test('invalid schema action or plan hash is rejected before resolving models or credentials', async () => {
  const handler = load('src/pages/api/models/migrate.ts', {
    '@/lib/api-helpers': { withApiHandler: (handler) => handler },
    '@/lib/auth': { requireUser: async () => ({ id: 1 }) },
    '@/lib/tenancy': { resolveTenant: async () => ({ id: 'tenant' }) },
  }).default;
  for (const body of [{ action: 'drop' }, { action: 1 }, { expectedPlanHash: 'invalid' }, { expectedPlanHash: null }]) {
    const res = response(); await handler({ method: 'POST', body }, res);
    assert.equal(res.statusCode, 400);
  }
});
