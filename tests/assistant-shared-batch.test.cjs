const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./security-harness.cjs");
const normalization = load(
  "src/lib/assistant/respond-runtime/codex-normalization.ts",
);
const directives = load(
  "src/lib/assistant/respond-runtime/codex-directives.ts",
  { "./codex-normalization": normalization },
);
const batch = load(
  "src/lib/assistant/respond-runtime/workspace-file-batch.ts",
  { "./codex-directives": directives, "./codex-normalization": normalization },
);
const execution = load("src/lib/assistant/respond-runtime/codex-execution.ts", {
  "./codex-types": load("src/lib/assistant/respond-runtime/codex-types.ts"),
  "./codex-normalization": normalization,
  "./codex-directives": directives,
  "./workspace-file-batch": batch,
});
const workspace = {
  modules: [],
  models: [],
  uiPackages: [],
  sharedUi: [],
  sharedModules: [],
};
const file = (path) => ({
  tool: "create_file",
  input: { path, content: "module.exports = {};" },
});

test("native diff creates each shared project once and writes all files without a repair turn", async () => {
  const projects = new Set();
  const written = [];
  const tools = {};
  for (const kind of ["ui", "module"])
    tools[`create_shared_${kind}_project`] = {
      execute: async (input) => {
        const key = `${kind}:${input.name}`;
        assert.ok(
          !projects.has(key),
          "Duplicate project creation is the regression",
        );
        projects.add(key);
      },
    };
  tools.write_shared_file = {
    execute: async (input) => {
      assert.ok(projects.has(`${input.projectKind}:${input.projectName}`));
      written.push(`${input.projectKind}:${input.path}`);
    },
  };
  const operations = [
    "shared-ui/widgets/index.jsx",
    "shared-ui/widgets/src/button.jsx",
    "shared-ui/widgets/src/modal.jsx",
    "shared-modules/domain/index.js",
    "shared-modules/domain/src/validation.js",
  ].map(file);
  const result = await execution.executeCodexOperations(
    tools,
    operations,
    workspace,
    () => [],
  );
  assert.deepEqual(result.errors, []);
  assert.equal(projects.size, 2);
  assert.equal(written.length, 5);
  assert.equal(result.executed, 7);
});

test("existing projects are reused and mixed or unsupported operations retain ordinary validation", () => {
  const existing = {
    ...workspace,
    sharedUi: [{ id: "existing", name: "widgets" }],
  };
  const expanded = batch.expandWorkspaceFileBatch(
    [file("shared-ui/widgets/src/button.jsx")],
    existing,
  );
  assert.equal(expanded.length, 1);
  assert.equal(expanded[0].input.projectId, "existing");
  assert.equal(
    batch.expandWorkspaceFileBatch(
      [file("shared-ui/widgets/a.jsx"), { tool: "update_acl_file", input: {} }],
      workspace,
    ),
    null,
  );
  assert.equal(
    batch.expandWorkspaceFileBatch(
      [file("shared-ui/widgets/a.jsx"), file("unsupported/file.js")],
      workspace,
    ),
    null,
  );
  assert.equal(
    batch.expandWorkspaceFileBatch(
      [{ tool: "create_file", input: {} }],
      workspace,
    ),
    null,
  );
});
