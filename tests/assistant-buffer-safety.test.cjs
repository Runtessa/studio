const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./security-harness.cjs');
const { LiveBufferGuard } = load('src/components/editor/utils/liveBufferGuard.ts');
const edit = (content) => ({ path: 'ui/app.jsx', action: 'edit', content });

test('initial authorized dirty buffer can receive updates; queued deltas and StrictMode updater replays stay consistent', () => {
  const guard = new LiveBufferGuard();
  guard.begin({ a: 'initial draft' });
  const first = guard.update({ a: 'saved' }, ['a'], edit('first'));
  const second = guard.update({ a: 'saved' }, ['a'], edit('second'));
  const original = { a: 'initial draft', other: 'untouched' };
  assert.deepEqual(first(original), first(original));
  const state = first(original);
  assert.deepEqual(second(state), second(state));
  assert.equal(second(state).a, 'second');
  assert.equal(guard.conflicts.size, 0);
});
test('typing during a live run survives all later updates and rollback', () => {
  const guard = new LiveBufferGuard();
  guard.begin({ a: 'saved' });
  let state = guard.update({ a: 'saved' }, ['a'], edit('assistant'))({ a: 'saved' });
  state = { ...state, a: 'new manual edit' };
  state = guard.update({ a: 'saved' }, ['a'], edit('assistant second'))(state);
  assert.equal(state.a, 'new manual edit');
  assert.equal(guard.finishUpdater(true)(state).a, 'new manual edit');
  assert.ok(guard.conflicts.has('a'));
});
test('manual edits after the last delta remain protected at completion', () => {
  const guard = new LiveBufferGuard();
  guard.begin({ a: 'saved' });
  guard.update({ a: 'saved' }, ['a'], edit('assistant'))({ a: 'saved' });
  const state = guard.finishUpdater(false)({ a: 'manual after last delta' });
  assert.equal(state.a, 'manual after last delta');
  assert.ok(guard.conflicts.has('a'));
});
test('rollback restores only unchanged assistant buffers and retains unrelated edits', () => {
  const guard = new LiveBufferGuard();
  guard.begin({ a: 'initial dirty' });
  let state = guard.update({ a: 'saved' }, ['a'], edit('assistant'))({ a: 'initial dirty', b: 'manual' });
  const revert = guard.finishUpdater(true);
  assert.deepEqual(revert(state), { a: 'initial dirty', b: 'manual' });
  assert.deepEqual(revert(state), { a: 'initial dirty', b: 'manual' });
});
test('a file opened and modified after run start is preserved', () => {
  const guard = new LiveBufferGuard();
  guard.begin({});
  assert.equal(guard.update({ a: 'saved' }, ['a'], edit('assistant'))({ a: 'new draft' }).a, 'new draft');
});

test('the final refresh rechecks edits made while its server request was in flight', () => {
  const guard = new LiveBufferGuard();
  guard.begin({ a: 'saved', b: 'saved' });
  guard.update({ a: 'saved' }, ['a'], edit('assistant'))({ a: 'saved' });
  guard.finishUpdater(false)({ a: 'assistant' });
  assert.equal(guard.canRefresh('a', 'assistant'), true);
  assert.equal(guard.canRefresh('a', 'typed during refresh'), false);
  assert.equal(guard.canRefresh('b', 'manual without live delta'), false);
});
