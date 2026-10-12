const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./security-harness.cjs');
const presentation = load('src/components/editor/ai-panel/messagePresentation.ts');
const text = load('src/components/editor/ai-panel/messageText.ts', { './messagePresentation': presentation });

const shared = {
  ...text,
  createId: () => String(Math.random()),
  mapRunSteps: () => [],
  mergeChanges: (a = [], b = []) => [...a, ...b],
  mergeProgressLines: (a = [], b) => [...a, b],
  mergeSteps: (a = [], b = []) => [...a, ...b],
  mergeLiveWorkspaceFiles: (a = [], b) => [...a, b],
  formatRunStep: () => '',
};
const stream = load('src/components/editor/ai-panel/assistantStream.ts', { './shared': shared });
const perform = load('src/components/editor/ai-panel/performAssistantRequest.ts', {
  './assistantStream': stream,
  './shared': shared,
});
const runChat = async (events, jsonResult, readOnly = false) => {
  let messages = [];
  const successes = [];
  const errors = [];
  let requestBody;
  const refreshed = [];
  const hook = load('src/components/editor/ai-panel/useAssistantChat.ts', {
    react: {
      useCallback: (callback) => callback,
      useEffect: () => {},
      useState: (initial) => [initial, () => {}],
      useRef: (initial) => ({ current: initial }),
    },
    './shared': shared,
    './performAssistantRequest': perform,
    './assistantChatContext': load('src/components/editor/ai-panel/assistantChatContext.ts'),
    './useRecoverRuns': { useRecoverRuns: () => {} },
  });
  const assistant = hook.useAssistantChat({
    input: 'Inspect the current file',
    messages,
    chatSessionId: 'chat',
    activeFileContext: null,
    settings: {
      readOnly,
      model: '',
      allowClientConfig: true,
      watchPreviewExceptions: false,
    },
    setInput: () => {},
    setMessages: (next) => {
      messages = typeof next === 'function' ? next(messages) : next;
    },
    apiStreamFetch: async (_, options) => {
      requestBody = options.body;
      if (jsonResult) return Response.json(jsonResult);
      const encoded = new TextEncoder().encode(
        events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
      );
      const body = new ReadableStream({
        start(controller) {
          // Split inside event JSON and multibyte text, as real network chunks do.
          for (let index = 0; index < encoded.length; index += 7)
            controller.enqueue(encoded.slice(index, index + 7));
          controller.close();
        },
      });
      return new Response(body, {
        headers: { 'content-type': 'text/event-stream' },
      });
    },
    onWorkspaceRefresh: (changes) => refreshed.push(changes),
    loadRuns: async () => {},
    success: (message) => successes.push(message),
    showError: (message) => errors.push(message),
  });
  await assistant.sendMessage();
  return { messages, successes, errors, requestBody, refreshed, assistant };
};

test('fragmented native reply keeps whitespace and Unicode; completion replaces streamed commentary', async () => {
  const result = await runChat([
    { type: 'delta', content: 'Reading' },
    { type: 'delta', content: ' ' },
    { type: 'delta', content: 'فایل' },
    {
      type: 'done',
      message: 'File inspected.\n[pipeline] executed=0 changes=0',
      changes: [],
    },
  ]);
  assert.equal(result.messages[1].content, 'File inspected.');
  assert.deepEqual(result.successes, ['Assistant finished']);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.requestBody.messages, [{ role: 'user', content: 'Inspect the current file' }]);
  assert.deepEqual(result.refreshed, []);
});

test('JSON completion refreshes exactly the applied changes before reporting success', async () => {
  const changes = [{ kind: 'ui', action: 'update', before: { id: 'a' }, after: { id: 'a' } }];
  const result = await runChat([], { message: 'Heading updated.', changes });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.refreshed, [changes]);
  assert.deepEqual(result.successes, ['Assistant updated the workspace']);
});

test('a stream that ends without completion reports an error instead of success', async () => {
  const result = await runChat([{ type: 'delta', content: 'Partial answer' }]);
  assert.deepEqual(result.successes, []);
  assert.match(result.errors[0], /ended before completion/);
  assert.match(result.messages[1].content, /ended before completion/);
});

test('failed cached JSON preserves saved changes and never announces success', async () => {
  const changes = [{ kind: 'module', action: 'update', after: { id: 'a' } }];
  const result = await runChat([], {
    runId: 'failed-run',
    status: 'failed',
    message: 'Stopped by you.',
    changes,
  });
  assert.equal(result.messages[1].status, 'failed');
  assert.equal(result.messages[1].runId, 'failed-run');
  assert.deepEqual(result.refreshed, [changes]);
  assert.deepEqual(result.successes, []);
  assert.deepEqual(result.errors, ['Stopped by you.']);
});
test('equivalent pending SSE stays recoverable and does not announce completion', async () => {
  const result = await runChat([
    { type: 'start', runId: 'in-progress' },
    { type: 'done', pending: true, runId: 'in-progress' },
  ]);
  assert.equal(result.messages[1].status, 'running');
  assert.equal(result.messages[1].runId, 'in-progress');
  assert.deepEqual(result.successes, []);
});
test('a disconnected known run retains its ID for automatic recovery', async () => {
  const result = await runChat([
    { type: 'start', runId: 'recover-me' },
    { type: 'delta', content: 'Partial' },
  ]);
  assert.equal(result.messages[1].status, 'running');
  assert.equal(result.messages[1].runId, 'recover-me');
  assert.deepEqual(result.successes, []);
});
test('read-only mode and independent request nonce reach the server', async () => {
  const result = await runChat([], { status: 'completed', message: 'Inspected.' }, true);
  assert.equal(result.requestBody.context.readOnly, true);
  assert.match(result.requestBody.requestId, /^assistant-/);
});
test('recovery returns authoritative failed runs with partial changes while temporary errors stay pending', async () => {
  const recovery = load('src/components/editor/ai-panel/recoverRuns.ts', { './shared': shared });
  const messages = [
    { id: 'a', role: 'assistant', status: 'running', runId: 'saved' },
    { id: 'b', role: 'assistant', status: 'running', runId: 'offline' },
  ];
  const result = await recovery.recoverAssistantMessages(messages, async (path) => {
    if (path.endsWith('offline')) throw Error('offline');
    return { status: 'failed', message: 'Stopped.', changes: [{ kind: 'ui' }] };
  });
  assert.equal(result.get('a').status, 'failed');
  assert.equal(result.get('a').changes.length, 1);
  assert.equal(result.has('b'), false);
});

test('copy keeps exact code indentation and the terminal newline', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let copied;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => { copied = value; } } } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator; });
  const result = await runChat([], { message: 'Ready.' });
  const code = '  const task = 1;\n';
  await result.assistant.handleCopyMessage(code);
  assert.equal(copied, code);
});
