const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./security-harness.cjs');
const { operationMocks } = require('./assistant-test-runtime.cjs');
const { executeCodexOperations } = load(
  'src/lib/assistant/respond-runtime/codex-execution.ts',
  operationMocks,
);
const { assertWorkspacePreconditions } = load(
  'src/lib/assistant/respond-runtime/workspace-preconditions.ts',
  {
    ...operationMocks,
    './workspace-snapshot': load('src/lib/assistant/respond-runtime/workspace-snapshot.ts'),
    './workspace-overlay': load('src/lib/assistant/respond-runtime/workspace-overlay.ts'),
  },
);
const empty = {
  modules: [],
  models: [],
  uiPackages: [],
  sharedUi: [],
  sharedModules: [],
  sharedUiFiles: [],
  sharedModuleFiles: [],
};
const baseline = { ...empty, modules: [{ id: 'm', method: 'GET', routePath: '/api/tasks', code: 'saved' }] };
const update = { tool: 'update_module', input: { id: 'm', code: 'assistant' } };
const preflight = (current, operations = [update], appliedChanges = [], baselineAcl = {}, currentAcl = {}) =>
  assertWorkspacePreconditions({ baseline, current, operations, appliedChanges, baselineAcl, currentAcl });

test('a read-only batch rejects mutations before any tool runs, including virtual aliases', async () => {
  for (const tool of ['update_module', 'write-file', 'create_shared_module_project', 'update_acl_file']) {
    let calls = 0;
    await assert.rejects(
      executeCodexOperations(
        { get_module: { execute: () => calls++ }, [tool]: { execute: () => calls++ } },
        [{ tool: 'get_module' }, { tool, input: { path: 'modules/api/tasks/get.module.js' } }],
        baseline,
        () => [],
        undefined,
        undefined,
        { readOnly: true },
      ),
      (error) => error.code === 'assistant-read-only',
    );
    assert.equal(calls, 0);
  }
});
test('read-only inspection can use read tools', async () => {
  let calls = 0;
  await executeCodexOperations(
    { get_module: { execute: () => calls++ } },
    [{ tool: 'get_module' }],
    baseline,
    () => [],
    undefined,
    undefined,
    { readOnly: true },
  );
  assert.equal(calls, 1);
});
test('cancellation stops subsequent writes and preserves already saved changes', async () => {
  const controller = new AbortController();
  let calls = 0;
  const changes = [];
  const tool = {
    execute: () => {
      calls++;
      changes.push({ kind: 'module' });
      controller.abort(Error('Stop'));
    },
  };
  await assert.rejects(
    executeCodexOperations(
      { update_module: tool },
      [update, update],
      baseline,
      () => changes,
      undefined,
      undefined,
      { signal: controller.signal },
    ),
    /Stop/,
  );
  assert.equal(calls, 1);
  assert.equal(changes.length, 1);
});
test('changed touched files are blocked; unrelated edits are allowed', () => {
  assert.throws(
    () => preflight({ ...baseline, modules: [{ ...baseline.modules[0], code: 'new user save' }] }),
    (error) => error.code === 'assistant-workspace-conflict',
  );
  assert.doesNotThrow(() =>
    preflight({ ...baseline, models: [{ id: 'unrelated', path: 'models/other.js', code: 'new' }] }),
  );
});
test('mixed virtual file operations cannot bypass the conflict check', () => {
  assert.throws(
    () =>
      preflight({ ...baseline, modules: [{ ...baseline.modules[0], code: 'manual' }] }, [
        { tool: 'update_file', input: { path: 'modules/api/tasks/get.module.js', content: 'next' } },
        { tool: 'get_module' },
      ]),
    /Files changed/,
  );
});
test('repair attempts recognize their own earlier writes without accepting later manual overwrites', () => {
  const after = { ...baseline.modules[0], code: 'assistant first pass' };
  const applied = [{ kind: 'module', action: 'update', before: baseline.modules[0], after }];
  assert.doesNotThrow(() => preflight({ ...baseline, modules: [after] }, [update], applied));
  assert.throws(
    () => preflight({ ...baseline, modules: [{ ...after, code: 'manual after pass' }] }, [update], applied),
    /Files changed/,
  );
});
test('new target collisions and model rename collisions are rejected', () => {
  assert.throws(
    () =>
      preflight({ ...baseline, models: [{ id: 'n', path: 'models/new.js', code: 'manual' }] }, [
        { tool: 'create_model', input: { path: 'models/new.js', code: 'assistant' } },
      ]),
    /Files changed/,
  );
  assert.throws(
    () =>
      preflight({ ...baseline, models: [{ id: 'n', path: 'models/new.js', code: 'manual' }] }, [
        { tool: 'update_model', input: { id: 'old', newPath: 'models/new.js' } },
      ]),
    /Files changed/,
  );
});
test('shared frontend and backend files and ACL config participate in conflicts', () => {
  for (const kind of ['ui', 'module']) {
    const project = { id: 'p', name: 'common', version: '1.0.0', dependencies: [], entryPath: 'index.js' };
    const file = { id: 'f', projectId: 'p', path: 'index.js', content: 'saved' };
    const projectsKey = kind === 'ui' ? 'sharedUi' : 'sharedModules';
    const filesKey = kind === 'ui' ? 'sharedUiFiles' : 'sharedModuleFiles';
    const source = { ...empty, [projectsKey]: [project], [filesKey]: [file] };
    assert.throws(
      () =>
        assertWorkspacePreconditions({
          baseline: source,
          current: { ...source, [filesKey]: [{ ...file, content: 'manual' }] },
          baselineAcl: {},
          currentAcl: {},
          operations: [
            {
              tool: 'write_shared_file',
              input: { projectKind: kind, projectId: 'p', path: 'index.js', content: 'assistant' },
            },
          ],
        }),
      /Files changed/,
    );
  }
  assert.throws(
    () =>
      preflight(
        baseline,
        [{ tool: 'update_acl_file', input: { file: 'endpoints' } }],
        [],
        { endpoints: { old: true } },
        { endpoints: { new: true } },
      ),
    /acl:endpoints/,
  );
});

test('native aliases and project IDs share one writer identity across all tenant workspaces', () => {
  const resources = load('src/lib/assistant/respond-runtime/shared-write-resources.ts', operationMocks);
  const workspace = { ...empty, sharedModules: [{ id: 'p', name: 'domain', version: '2.0.0' }] };
  const fromId = resources.sharedWriteResources([{ tool: 'write_shared_file', input: { projectKind: 'module', projectId: 'p', path: 'src/a.js' } }], workspace);
  const fromPath = resources.sharedWriteResources([{ tool: 'update_file', input: { path: 'shared-modules/domain/src/b.js', content: 'next' } }], workspace);
  assert.deepEqual(fromId, ['assistant:shared-writer:module:domain@2.0.0']);
  assert.deepEqual(fromPath, fromId);
  assert.deepEqual(resources.sharedWriteResources([{ tool: 'get_shared_file', input: { projectKind: 'module', projectId: 'p' } }], workspace), []);
});
