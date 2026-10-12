const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./security-harness.cjs');
const contracts = load('src/lib/assistant/codeContracts.ts');

test('assistant edits accept both existing Kernel App export styles without adding unused networking', () => {
  for (const prefix of ['export function', 'export default function']) {
    const code = `${prefix} App() { return <h1>Assistant verified</h1>; }`;
    assert.doesNotThrow(() =>
      contracts.assertDashboardEntrypointCode('@app/dashboard', code),
    );
  }
  assert.throws(
    () =>
      contracts.assertDashboardEntrypointCode(
        '@app/dashboard',
        'export default [];',
      ),
    /must export function App/,
  );
});

test('App compatibility preserves API-client, ORM and simulated-data restrictions', () => {
  const app = (body) =>
    `export default function App() { ${body} return null; }`;
  assert.throws(
    () =>
      contracts.assertDashboardEntrypointCode(
        '@app/dashboard',
        app('fetch("/api/status");'),
      ),
    /Direct network/,
  );
  assert.throws(
    () =>
      contracts.assertDashboardEntrypointCode(
        '@app/dashboard',
        app('const url = "/api/status";'),
      ),
    /import and use/,
  );
  assert.throws(
    () =>
      contracts.assertDashboardEntrypointCode(
        '@app/dashboard',
        `import {Entity} from 'typeorm'; ${app('')}`,
      ),
    /cannot import/,
  );
  const realClient = `import {useApiClient} from '@app/datacontext'; ${app('const client = useApiClient(); client.get("/api/status");')}`;
  assert.doesNotThrow(() =>
    contracts.assertDashboardEntrypointCode('@app/dashboard', realClient),
  );
});

test('explicit read-only review with forbidden actions remains read-only through scope and coverage checks', () => {
  const paths = load('src/lib/assistant/respond-runtime/workspace-paths.ts');
  const sessions = load('src/lib/assistant/respond-runtime/agent-session.ts', {
    './workspace-paths': paths,
    './task-scope': load('src/lib/assistant/respond-runtime/task-scope.ts'),
    './editor-context': load(
      'src/lib/assistant/respond-runtime/editor-context.ts',
    ),
  });
  const pipeline = load('src/lib/assistant/respond-runtime/pipeline-shared.ts');
  const objective =
    'Read-only: inspect backend routes and UI. Do not create, edit, delete or migrate anything.';
  const session = sessions.buildAgentWorkspaceSession({
    chatId: 'test',
    messages: [{ role: 'user', content: objective }],
    workspace: {
      modules: [],
      models: [],
      uiPackages: [],
      sharedUi: [],
      sharedModules: [],
    },
    acl: { permissions: {}, roles: {}, endpoints: {} },
  });
  assert.equal(session.task.expectations.mode, 'read-only');
  assert.equal(pipeline.promptLooksLikeMutation(objective), false);
  assert.deepEqual(
    pipeline.buildCoverageConflicts(session, [], [], [], [], []),
    [],
  );
  assert.equal(pipeline.promptLooksLikeMutation('Update the UI heading'), true);
});

test('authorized active editor buffer replaces the disk snapshot; arbitrary IDs cannot overwrite other files', () => {
  const paths = load('src/lib/assistant/respond-runtime/workspace-paths.ts');
  const sessions = load('src/lib/assistant/respond-runtime/agent-session.ts', {
    './workspace-paths': paths,
    './task-scope': load('src/lib/assistant/respond-runtime/task-scope.ts'),
    './editor-context': load(
      'src/lib/assistant/respond-runtime/editor-context.ts',
    ),
  });
  const options = {
    chatId: 'test',
    messages: [{ role: 'user', content: 'Read-only inspect this file' }],
    workspace: {
      modules: [],
      models: [],
      sharedUi: [],
      sharedModules: [],
      uiPackages: [
        {
          id: 'owned',
          name: '@app/dashboard',
          version: '1',
          fileExtension: 'jsx',
          code: 'saved',
          dependencies: [],
        },
      ],
    },
    acl: { permissions: {}, roles: {}, endpoints: {} },
    activeFile: {
      id: 'owned',
      name: 'dashboard.ui.jsx',
      content: 'unsaved buffer',
    },
  };
  const session = sessions.buildAgentWorkspaceSession(options);
  assert.equal(
    session.workspace.files.find((file) => file.id === 'owned').content,
    'unsaved buffer',
  );
  const rejected = sessions.buildAgentWorkspaceSession({
    ...options,
    activeFile: {
      id: 'other-tenant-file',
      name: 'unrelated',
      content: 'overwrite',
    },
  });
  assert.equal(
    rejected.workspace.files.find((file) => file.id === 'owned').content,
    'saved',
  );
});

test('external gateway connection reflects actual health; disabled mode never probes', async (t) => {
  const previous = global.fetch;
  t.after(() => {
    global.fetch = previous;
  });
  const configs = load('src/lib/assistant/gateway-runtime/config.ts');
  const gateway = (mode) =>
    load('src/lib/assistant/gateway-runtime.ts', {
      '@/lib/assistant/gateway-runtime/config': {
        ...configs,
        resolveGatewayMode: () => mode,
      },
    });
  global.fetch = async () => Response.json({ ok: true });
  assert.equal(
    (await gateway('local').getCodexGatewayRuntimeStateForUser('test')).running,
    true,
  );
  global.fetch = async () => {
    throw Error('offline');
  };
  assert.equal(
    (await gateway('local').getCodexGatewayRuntimeStateForUser('test')).running,
    false,
  );
  global.fetch = async () => {
    assert.fail('disabled gateway must not probe');
  };
  assert.equal(
    (await gateway('disabled').getCodexGatewayRuntimeStateForUser('test'))
      .running,
    false,
  );
});

test('actual IDE IDs, dirty open files, ACL buffers and selected source ranges map to authorized workspace files', () => {
  const { applyEditorContext } = load(
    'src/lib/assistant/respond-runtime/editor-context.ts',
  );
  const files = [
    {
      id: 'package-a',
      path: 'ui/@app/dashboard.ui.jsx',
      kind: 'ui',
      content: 'saved',
    },
    {
      id: 'module-b',
      path: 'modules/api/status/get.module.js',
      kind: 'module',
      content: 'old',
    },
    { path: 'modules/acl/endpoints.json', kind: 'acl', content: '{}' },
  ];
  const active = {
    id: 'ui-package-a',
    name: 'dashboard.ui.jsx',
    meta: { kind: 'ui', backendId: 'package-a' },
    content: 'first line\nselected line\nlast line',
  };
  const open = [
    {
      id: 'module-module-b',
      name: 'get.module.js',
      meta: { kind: 'module', backendId: 'module-b' },
      content: 'unsaved backend',
    },
    {
      id: 'acl-endpoints',
      name: 'endpoints.json',
      meta: { kind: 'acl', file: 'endpoints' },
      content: '{"draft":true}',
    },
    {
      id: 'ui-foreign',
      name: 'dashboard.ui.jsx',
      meta: { kind: 'ui', backendId: 'foreign' },
      content: 'unauthorized',
    },
  ];
  const result = applyEditorContext(files, active, open, {
    fileId: 'ui-package-a',
    startLineNumber: 2,
    startColumn: 1,
    endLineNumber: 2,
    endColumn: 14,
  });
  assert.equal(result.selectedFile.path, 'ui/@app/dashboard.ui.jsx');
  assert.equal(result.selection.text, 'selected line');
  assert.equal(files[1].content, 'unsaved backend');
  assert.equal(files[2].content, '{"draft":true}');
  assert.equal(result.openFiles.length, 3);
  assert.ok(result.openFiles.every((file) => file.isDirty));
});

test('malformed IDs and reversed/out-of-range selections cannot inject source context', () => {
  const { applyEditorContext } = load(
    'src/lib/assistant/respond-runtime/editor-context.ts',
  );
  const files = [
    { id: 'a', path: 'ui/app.jsx', kind: 'ui', content: 'abcdef' },
  ];
  const active = { id: 'ui-a', name: 'app.jsx' };
  for (const range of [
    { startColumn: 5, endColumn: 2 },
    { startColumn: 1, endColumn: 20 },
  ]) {
    assert.equal(
      applyEditorContext(files, active, [null, 3, {}], {
        fileId: 'ui-a',
        startLineNumber: 1,
        endLineNumber: 1,
        ...range,
      }).selection,
      null,
    );
  }
  assert.equal(files[0].content, 'abcdef');
});
