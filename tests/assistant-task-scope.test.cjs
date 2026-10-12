const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./security-harness.cjs");
const { inferTaskExpectations } = load(
  "src/lib/assistant/respond-runtime/task-scope.ts",
);
const { buildCoverageConflicts } = load(
  "src/lib/assistant/respond-runtime/pipeline-shared.ts",
);
const scope = (objective, path = "ui/@app/dashboard.ui.jsx") => ({
  task: { objective, expectations: inferTaskExpectations(objective, path) },
});

test("shared quality changes do not require preserved ORM models or ACL updates", () => {
  const objective =
    "Update shared Field and Select components. Add validation tests in the shared backend package. Preserve existing ORM models, all API contracts, ACL, and data. Do not publish the UI or shared projects.";
  const session = scope(objective);
  assert.equal(session.task.expectations.models, false);
  assert.equal(session.task.expectations.acl, false);
  assert.equal(session.task.expectations.ui, true);
  assert.equal(session.task.expectations.shared, true);
  const changes = [
    { kind: "shared-file", projectKind: "module" },
    { kind: "shared-file", projectKind: "ui" },
  ];
  assert.deepEqual(
    buildCoverageConflicts(session, [], changes, [], [], []),
    [],
  );
});

test("backend logic fixes do not require an unrelated ACL mutation", () => {
  const session = scope(
    "Fix the backend handler validation. Keep API contracts unchanged; leave ORM models untouched.",
  );
  assert.equal(session.task.expectations.backend, true);
  assert.equal(session.task.expectations.models, false);
  assert.equal(session.task.expectations.acl, false);
  assert.equal(
    session.task.expectations.ui,
    false,
    "active UI file cannot expand an explicitly backend task",
  );
  assert.deepEqual(
    buildCoverageConflicts(session, [], [{ kind: "module" }], [], [], []),
    [],
  );
});

test("explicit positive surface requirements and operation failures still produce conflicts", () => {
  const session = scope(
    "Create backend routes, ORM models, frontend components and ACL permissions.",
  );
  const conflicts = buildCoverageConflicts(
    session,
    [],
    [{ kind: "ui" }],
    [],
    [],
    [],
  );
  assert(conflicts.some((item) => /backend/.test(item.message)));
  assert(conflicts.some((item) => /ORM/.test(item.message)));
  assert(conflicts.some((item) => /ACL/.test(item.message)));
  assert(
    buildCoverageConflicts(
      scope("Update UI"),
      [],
      [{ kind: "ui" }],
      [],
      ["save failed"],
      [],
    ).some((item) => /save failed/.test(item.message)),
  );
});

test("read-only intent, preservation clauses and active-file fallback remain separate", () => {
  assert.equal(
    inferTaskExpectations(
      "Read-only: inspect backend. Do not create or delete anything.",
      "models/Task.js",
    ).mode,
    "read-only",
  );
  assert.equal(
    inferTaskExpectations("فقط بررسی کن. به مدل و ACL دست نزن.", "").mode,
    "read-only",
  );
  const fallback = inferTaskExpectations(
    "Fix this typo",
    "shared-ui/controls/index.jsx",
  );
  assert.equal(fallback.ui, true);
  assert.equal(fallback.shared, true);
  const requested = inferTaskExpectations(
    "Preserve API contracts while updating frontend components.",
    "models/Task.js",
  );
  assert.equal(requested.ui, true);
  assert.equal(requested.backend, false);
  assert.equal(requested.models, false);
  const review = scope(
    "Inspect backend and UI. Do not create, edit or delete anything.",
  );
  assert.equal(review.task.expectations.mode, "read-only");
  assert.deepEqual(buildCoverageConflicts(review, [], [], [], [], []), []);
});
