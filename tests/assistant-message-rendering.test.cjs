const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./security-harness.cjs');
const root = path.resolve(__dirname, '../src/components/editor/ai-panel');
const presentation = load('src/components/editor/ai-panel/messagePresentation.ts');
const text = load('src/components/editor/ai-panel/messageText.ts', { './messagePresentation': presentation });
const modules = new Map();
function ui(name) {
  if (modules.has(name)) return modules.get(name);
  const filename = path.join(root, name + '.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)((id) => {
    if (id.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => String(key) });
    if (id === './messagePresentation') return presentation;
    if (id === './shared') return {
      MonacoDiffEditor: () => React.createElement('div', { 'data-diff': true }),
      buildChangeDiffPayload: (change) => ({ path: 'models/Task.js', before: change.before?.code || '', after: change.after?.code || '', language: 'javascript' }),
      uniqueChangeKey: (change) => change.after?.id || change.before?.id,
      formatChange: (change) => 'Updated models/Task.js',
    };
    if (id.startsWith('./')) return ui(id.slice(2));
    return require(id);
  }, mod, mod.exports);
  modules.set(name, mod.exports); return mod.exports;
}
const Markdown = ui('AssistantMarkdown').AssistantMarkdown;
const render = (content) => renderToStaticMarkup(React.createElement(Markdown, { content, messageId: 'test', onCopy: async () => {} }));

test('actual renderer produces headings, bold text, nested lists, inline code, tables and task lists', () => {
  const html = render('## Ready\n\n**16 tests passed** and `Taskflow`.\n\n- Backend\n  - Shared validator\n\n| Surface | Package |\n| --- | --- |\n| Backend | domain |\n\n- [x] Verified');
  assert.match(html, /<h2>Ready<\/h2>/); assert.match(html, /<strong>16 tests passed<\/strong>/);
  assert.match(html, /<code>Taskflow<\/code>/); assert.match(html, /<ul>[\s\S]*<ul>/);
  assert.match(html, /aria-label="Response table"/); assert.match(html, /<table>/);
  assert.match(html, /type="checkbox"/); assert.doesNotMatch(html, /\*\*16/);
});
test('fenced code preserves indentation, language, literal markup and has a copy action', () => {
  const source = '  const value = "<script>never execute</script>";\n';
  const html = render('```javascript\n' + source + '```');
  assert.match(html, /aria-label="Copy code"/); assert.match(html, /aria-label="javascript code"/);
  assert.match(html, /<code>  const value/); assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
test('incomplete streaming fences remain readable as code', () => {
  const html = render('Working:\n\n```typescript\nconst task = {');
  assert.match(html, /<pre/); assert.match(html, /const task = \{/);
});
test('raw HTML, script URLs and model images cannot execute or fetch remotely', () => {
  const html = render('<script>alert(1)</script>\n\n<img src="https://tracking.example/pixel" onerror="alert(1)">\n\n[unsafe](javascript:alert(1))\n\n![diagram](https://tracking.example/second)\n\n[safe](https://github.com/Runtessa/platform)');
  assert.doesNotMatch(html, /<script|<img|javascript:|onerror=|tracking\.example/);
  assert.match(html, /href="https:\/\/github.com\/Runtessa\/platform"/);
  assert.match(html, /rel="noopener noreferrer"/);
});
test('message normalization removes metadata without rewriting prose, code or numbered lists', () => {
  const source = '## Review\n\nIssues: none.\n\n1) First\n2) Second\n\n```text\n[pipeline] this is code\nQuestions: literal\n```\n[pipeline] executed=1';
  assert.equal(text.normalizeAssistantMessage(source), source.slice(0, source.lastIndexOf('\n[pipeline]')));
  assert.equal(presentation.assistantAnswer('Ready.\n- Applied write_shared_file\n```text\n- Applied write_shared_file\n```'), 'Ready.\n```text\n- Applied write_shared_file\n```');
});
test('long fences and mixed tilde/backtick fences cannot remove code content', () => {
  const source = '````markdown\n```\n[pipeline] preserve\n```\n````\n[stderr] hide';
  assert.equal(text.stripMetaLogLines(source), source.slice(0, source.lastIndexOf('\n[stderr]')));
});
test('activity reports a real elapsed time and retains stopped/failed/recovering states', () => {
  const msg = { content: '', events: [{ timestamp: '2026-10-12T12:00:00Z' }, { timestamp: '2026-10-12T12:01:14Z' }] };
  assert.equal(presentation.activityLabel(msg, false), 'Worked for 1m 14s');
  assert.equal(presentation.activityLabel({ ...msg, status: 'failed', content: 'Assistant stopped by you.' }, false), 'Stopped');
  assert.equal(presentation.activityLabel({ ...msg, status: 'running' }, false), 'Recovering result');
});
test('response shows markdown and collapsed activity/change review without exposing host summaries', () => {
  const msg = { id: 'reply', role: 'assistant', content: '**Saved.**\n- Applied update_model', status: 'completed', progress: ['Applied update_model'],
    changes: [{ kind: 'model', action: 'update', before: { id: 'm', code: 'old' }, after: { id: 'm', code: 'new' } }] };
  const html = renderToStaticMarkup(React.createElement(ui('MessageBubble').MessageBubble, { msg, sending: false, pendingAssistantId: null,
    openChangeDiffKeys: {}, setOpenChangeDiffKeys: () => {}, onCopyMessage: async () => {}, onRetryMessage: async () => {}, getRetryPrompt: () => 'prompt', onRollback: async () => {} }));
  assert.match(html, /<strong>Saved\.<\/strong>/); assert.match(html, /Review 1 change/);
  assert.match(html, /aria-label="Copy response"/); assert.doesNotMatch(html, /<details[^>]* open/);
});
