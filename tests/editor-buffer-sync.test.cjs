const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./security-harness.cjs");
const { assistantChangedBufferIds, reconcileSavedBuffers } = load(
  "src/components/editor/utils/reconcileBuffers.ts",
);

test("server refresh updates clean buffers and preserves genuine unsaved edits", () => {
  assert.deepEqual(
    reconcileSavedBuffers(
      { clean: "old", dirty: "local", deleted: "old" },
      { clean: "old", dirty: "old", deleted: "old" },
      { clean: "new", dirty: "new" },
    ),
    { clean: "new", dirty: "local" },
  );
});

test("assistant rollback replaces affected buffers before the next context request", () => {
  const files = [
    { id: "ui-a", meta: { kind: "ui", backendId: "a" } },
    { id: "module-a", meta: { kind: "module", backendId: "a" } },
    { id: "ui-other", meta: { kind: "ui", backendId: "other" } },
  ];
  const replaced = assistantChangedBufferIds(files, [
    { kind: "ui", action: "update", before: { id: "a" }, after: { id: "a" } },
  ]);
  assert.deepEqual(replaced, ["ui-a"]);
  assert.deepEqual(
    reconcileSavedBuffers(
      { "ui-a": "Signal Desk", "ui-other": "unsaved", "module-a": "backend" },
      { "ui-a": "Signal Desk", "ui-other": "saved", "module-a": "backend" },
      {
        "ui-a": "Assistant verified",
        "ui-other": "saved",
        "module-a": "backend",
      },
      replaced,
    ),
    {
      "ui-a": "Assistant verified",
      "ui-other": "unsaved",
      "module-a": "backend",
    },
  );
});

test("replacement scope covers ACL and shared files without crossing projects", () => {
  const files = [
    { id: "acl-roles", meta: { kind: "acl", file: "roles" } },
    { id: "acl-permissions", meta: { kind: "acl", file: "permissions" } },
    {
      id: "shared-file",
      meta: { kind: "shared", projectId: "p", fileId: "f" },
    },
    {
      id: "other-project-file",
      meta: { kind: "shared", projectId: "other", fileId: "f" },
    },
  ];
  assert.deepEqual(
    assistantChangedBufferIds(files, [
      { kind: "acl", action: "update", file: "roles" },
      {
        kind: "shared-file",
        action: "update",
        projectId: "p",
        before: { id: "f" },
      },
    ]),
    ["acl-roles", "shared-file"],
  );
  assert.deepEqual(
    assistantChangedBufferIds(files, [
      { kind: "shared-project", action: "update", before: { id: "p" } },
    ]),
    ["shared-file"],
  );
});
