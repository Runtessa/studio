const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./security-harness.cjs");
const normalization = load("src/lib/assistant/aclNormalization.ts");
const run = async (endpointExists) => {
  const fresh = {
    id: "tenant",
    aclPermissions: { permissions: [{ key: "taskflow.read" }] },
    aclRoles: { roles: { admin: ["manager"], manager: ["taskflow.read"] } },
    aclEndpoints: {
      "/existing": { read: ["taskflow.read"], allowAnonymous: false },
    },
  };
  if (endpointExists)
    fresh.aclEndpoints["/new"] = {
      read: ["taskflow.read"],
      write: ["taskflow.write"],
      allowAnonymous: false,
    };
  const updates = [];
  const repository = {
    findOne: async (options) => {
      assert.deepEqual(options.lock, { mode: "pessimistic_write" });
      return fresh;
    },
    update: async (id, patch) => {
      assert.equal(id, "tenant");
      updates.push(patch);
    },
  };
  const endpoint = load("src/lib/assistant/endpoint-acl.ts", {
    "./aclNormalization": normalization,
    "@/lib/core-db": {
      CoreDataSource: {
        transaction: async (fn) => fn({ getRepository: () => repository }),
      },
    },
  });
  const stale = {
    id: "tenant",
    aclPermissions: {},
    aclRoles: {},
    aclEndpoints: {},
  };
  const changes = [];
  await endpoint.ensureAclEndpoint(stale, "/new", changes);
  return { fresh, updates, stale, changes };
};
test("creating a backend route preserves freshly saved ACL and updates only endpoints under a row lock", async () => {
  const { fresh, updates, stale } = await run(false);
  assert.equal(updates.length, 1);
  assert.deepEqual(Object.keys(updates[0]), ["aclEndpoints"]);
  assert.deepEqual(stale.aclEndpoints["/existing"].read, ["taskflow.read"]);
  assert.equal(stale.aclEndpoints["/new"].allowAnonymous, false);
  assert.deepEqual(fresh.aclPermissions.permissions, [
    { key: "taskflow.read" },
  ]);
  assert.deepEqual(fresh.aclRoles.roles.admin, ["manager"]);
});
test("an existing protected endpoint retains its permissions when the request snapshot is stale", async () => {
  const { updates, stale } = await run(true);
  assert.deepEqual(updates, []);
  assert.deepEqual(stale.aclEndpoints["/new"].read, ["taskflow.read"]);
  assert.deepEqual(stale.aclEndpoints["/new"].write, ["taskflow.write"]);
});

test('automatic endpoint insertion is journaled so repairs recognize their own ACL write', async () => {
  const { changes } = await run(false);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].kind, 'acl');
  assert.equal(changes[0].before['/new'], undefined);
  assert.equal(changes[0].after['/new'].allowAnonymous, false);
  assert.equal((await run(true)).changes.length, 0);
});
