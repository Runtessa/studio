const test = require("node:test");
const assert = require("node:assert/strict");
const {
  load,
  route,
  actor,
  response,
  request,
  status,
} = require("./security-harness.cjs");

test("preview uses authenticated identity and tenant scope, never client-supplied actor", async () => {
  let issued;
  const user = actor("frontend_developer");
  const handler = route("preview/session.ts", user, {
    "@/lib/preview-session": {
      issuePreviewSession: async (actor, tenant) => {
        issued = { actor, tenant };
        return { token: "scoped-preview" };
      },
    },
  });
  const res = response();
  await handler(
    request("POST", "a.example.test", {
      actor: { isAdmin: true },
      tenantId: "tenant-b",
    }),
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(issued.actor, user);
  assert.equal(issued.tenant.id, "tenant-a");
  issued = null;
  await assert.rejects(
    handler(request("POST", "b.example.test"), response()),
    status(403),
  );
  assert.equal(issued, null);
  await assert.rejects(
    handler(request("POST", "suspended.example.test"), response()),
    status(403),
  );
});

test("preview requires read permission and authenticated user, and only accepts POST", async () => {
  for (const user of [null, actor("ops_engineer")]) {
    const handler = route("preview/session.ts", user);
    await assert.rejects(
      handler(request("POST"), response()),
      status(user ? 403 : 401),
    );
  }
  const handler = route("preview/session.ts", actor());
  const res = response();
  await handler(request("GET"), res);
  assert.equal(res.statusCode, 405);
});

test("preview keeps ordinary users as USER and uses only server-side connection settings", async () => {
  const originalFetch = global.fetch;
  const previousUrl = process.env.CORE_PREVIEW_INTERNAL_URL;
  const previousToken = process.env.CORE_STUDIO_PREVIEW_TOKEN;
  const { issuePreviewSession } = load("src/lib/preview-session.ts");
  let sent;
  process.env.CORE_PREVIEW_INTERNAL_URL = "http://runtime.internal:3005";
  process.env.CORE_STUDIO_PREVIEW_TOKEN = "internal-fixture";
  global.fetch = async (url, options) => {
    assert.equal(
      String(url),
      "http://runtime.internal:3005/auth/studio-preview",
    );
    assert.equal(options.headers.Authorization, "Bearer internal-fixture");
    assert.equal(options.redirect, "error");
    sent = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        token: "preview",
        tenantHost: "a.example.test",
        expiresAt: Date.now() + 600000,
      }),
    };
  };
  try {
    const tenant = { id: "tenant-a", hostname: "a.example.test" };
    await issuePreviewSession(actor("observer"), tenant);
    assert.equal(sent.actor.role, "USER");
    assert.equal(sent.tenantId, "tenant-a");
    await issuePreviewSession(actor("admin"), tenant);
    assert.equal(sent.actor.role, "ADMIN");
    delete process.env.CORE_STUDIO_PREVIEW_TOKEN;
    await assert.rejects(issuePreviewSession(actor(), tenant), status(503));
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of [
      ["CORE_PREVIEW_INTERNAL_URL", previousUrl],
      ["CORE_STUDIO_PREVIEW_TOKEN", previousToken],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
