const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./security-harness.cjs');
const { readOwnedAssistantChat } = load('src/components/editor/ai-panel/assistantChatStorage.ts');
const values = new Map();
const storage = { getItem: key => values.get(key) ?? null };
const prefix = 'chat';

test('browser history belongs to the authenticated user and tenant, not just the tenant', () => {
  values.clear();
  values.set('chat:user:1:tenant', JSON.stringify({ messages: [{ content: 'private user one' }], settings: { readOnly: true } }));
  values.set('chat:user:2:tenant', JSON.stringify({ messages: [{ content: 'private user two' }] }));
  assert.equal(readOwnedAssistantChat(storage, prefix, 'tenant', { userId: '1', isAdmin: false }).chat.messages[0].content, 'private user one');
  assert.equal(readOwnedAssistantChat(storage, prefix, 'tenant', { userId: '1', isAdmin: false }).chat.settings.readOnly, true);
  assert.equal(readOwnedAssistantChat(storage, prefix, 'tenant', { userId: '2', isAdmin: false }).chat.messages[0].content, 'private user two');
  assert.deepEqual(readOwnedAssistantChat(storage, prefix, 'other', { userId: '1', isAdmin: false }).chat, {});
});
test('legacy ownerless chats are preserved and migrated only for administrators', () => {
  values.clear();
  const legacy = JSON.stringify({ chatSessionId: 'original', messages: [{ content: 'original history' }], isAdmin: true });
  values.set('chat:tenant', legacy);
  assert.deepEqual(readOwnedAssistantChat(storage, prefix, 'tenant', { userId: '2', isAdmin: false }).chat, {});
  assert.equal(readOwnedAssistantChat(storage, prefix, 'tenant', { userId: '1', isAdmin: true }).chat.chatSessionId, 'original');
  assert.equal(values.get('chat:tenant'), legacy);
});
test('owned history wins over legacy data, and absent identity cannot expose any chat', () => {
  values.clear(); values.set('chat:tenant', JSON.stringify({ chatSessionId: 'legacy' }));
  values.set('chat:user:1:tenant', JSON.stringify({ chatSessionId: 'owned' }));
  assert.equal(readOwnedAssistantChat(storage, prefix, 'tenant', { userId: '1', isAdmin: true }).chat.chatSessionId, 'owned');
  assert.throws(() => readOwnedAssistantChat(storage, prefix, 'tenant', { userId: '', isAdmin: true }), /identity/);
});
