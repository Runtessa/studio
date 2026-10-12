const test = require('node:test');
const assert = require('node:assert/strict');
const { load, route, response, request, actor } = require('./security-harness.cjs');
const sharp = require('sharp');
const types = load('src/lib/assistant/attachment-types.ts');
const validation = load('src/lib/assistant/attachment-validation.ts', { './attachment-types': types, sharp: { default: sharp } });
const strings = new Map(), deleted = [];
const store = load('src/lib/assistant/attachment-store.ts', {
  './attachment-validation': validation, './attachment-types': types,
  'node:crypto': require('node:crypto'),
  '@/lib/redis': { default: { get: async key => strings.get(key), eval: async (_script, _n, key, _quota, raw) => { strings.set(key, raw); return 1; },
    del: async key => { deleted.push(key); strings.delete(key); }, hdel: async () => 1 } },
});
const owner = { userId: 10, tenantId: 'tenant-a' };
const text = (name = 'example.ts', content = 'export const value = 42;') => ({ name, base64: Buffer.from(content).toString('base64') });

test('text and code contents round-trip with owned metadata and no binary in the reference', async () => {
  const ref = await store.saveAttachment(owner, text());
  assert.equal(ref.kind, 'text'); assert.equal(ref.base64, undefined);
  const record = await store.readAttachment(owner, ref.id);
  assert.equal(Buffer.from(record.base64, 'base64').toString(), 'export const value = 42;');
  assert.deepEqual(await store.resolveAttachments(owner, [ref.id]), [record]);
});
test('IDs are isolated across users and tenants, including delete and execution', async () => {
  const ref = await store.saveAttachment(owner, text());
  for (const other of [{ ...owner, userId: 11 }, { ...owner, tenantId: 'tenant-b' }]) {
    await assert.rejects(store.readAttachment(other, ref.id), err => err.statusCode === 404);
    await assert.rejects(store.removeAttachment(other, ref.id), err => err.statusCode === 404);
    await assert.rejects(store.resolveAttachments(other, [ref.id]), err => err.statusCode === 404);
  }
  await store.removeAttachment(owner, ref.id);
  await assert.rejects(store.readAttachment(owner, ref.id), err => err.statusCode === 404);
});
test('reject traversal, malformed encoding, unsupported formats, binary and oversized text', async () => {
  for (const payload of [text('../escape.ts'), text('fake.pdf'), { name: 'test.txt', base64: '%%%==' }, text('test.txt', '\0binary'),
    { name: 'test.txt', base64: Buffer.alloc(types.MAX_TEXT_BYTES + 1, 65).toString('base64') }, { name: 'test.txt', base64: '/w==' }])
    await assert.rejects(validation.validateAttachment(payload), err => [400, 413].includes(err.statusCode));
});
test('image decoding rejects spoofed MIME, broken images and oversized dimensions', async () => {
  await assert.rejects(validation.validateAttachment(text('fake.png')));
  const png = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#007acc' } }).png().toBuffer();
  const record = await validation.validateAttachment({ name: 'real.png', base64: png.toString('base64'), mime: 'image/jpeg' });
  assert.equal(record.mime, 'image/png');
  await assert.rejects(validation.validateAttachment({ name: 'fake.jpg', base64: png.toString('base64') }));
  const large = await sharp({ create: { width: 8193, height: 1, channels: 3, background: '#fff' } }).png().toBuffer();
  await assert.rejects(validation.validateAttachment({ name: 'large.png', base64: large.toString('base64') }));
});
test('preview notes preserve region coordinates and reject missing notes, off-image marks and mismatched dimensions', async () => {
  const png = await sharp({ create: { width: 100, height: 50, channels: 4, background: '#fff' } }).png().toBuffer();
  const preview = { route: '/tasks', stage: 'draft', width: 100, height: 50, marks: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.4, note: '  Align this card  ' }] };
  const valid = await validation.validateAttachment({ name: 'preview.png', base64: png.toString('base64'), preview });
  assert.equal(valid.preview.marks[0].note, 'Align this card'); assert.equal(valid.preview.marks[0].width, 0.3);
  for (const changed of [{ ...preview, width: 101 }, { ...preview, marks: [{ ...preview.marks[0], x: 0.9 }] },
    { ...preview, marks: [{ ...preview.marks[0], note: '' }] }, { ...preview, route: 'https://outside.test' }])
    await assert.rejects(validation.validateAttachment({ name: 'preview.png', base64: png.toString('base64'), preview: changed }));
});
test('execution rejects duplicate, invalid and excessive attachment refs before reading', async () => {
  const ref = await store.saveAttachment(owner, text());
  for (const ids of [[ref.id, ref.id], ['../../file'], Array(6).fill(ref.id), { id: ref.id }])
    await assert.rejects(store.resolveAttachments(owner, ids), err => err.statusCode === 400);
  assert.deepEqual(await store.resolveAttachments(owner, undefined), []);
});
test('upload, read and delete routes require tenant permissions; records remain private to their owner', async () => {
  const routes = { '@/lib/assistant/attachment-store': store };
  const upload = route('assistant/attachments/index.ts', actor(), routes);
  const res = response(); await upload(request('POST', 'a.example.test', text()), res);
  assert.equal(res.statusCode, 201);
  const get = route('assistant/attachments/[id].ts', actor(), routes);
  const req = request('GET'); req.query.id = res.payload.attachment.id;
  const read = response(); await get(req, read); assert.equal(read.payload.attachment.name, 'example.ts');
  await assert.rejects(upload(request('POST', 'b.example.test', text()), response()), err => err.statusCode === 403);
  const other = route('assistant/attachments/[id].ts', { ...actor(), id: 11 }, routes);
  await assert.rejects(other(req, response()), err => err.statusCode === 404);
});
test('attachment-only requests include refs, and chat history carries metadata rather than file contents', () => {
  const chat = load('src/components/editor/ai-panel/assistantChatContext.ts');
  const ref = { id: 'abc', name: 'one.png', kind: 'image', mime: 'image/png', size: 1 };
  const body = chat.buildChatPayload({ messages: [], chatSessionId: 'chat', settings: {}, systemPrompt: '', activeFileContext: null },
    { role: 'user', content: 'Review the attached files.', attachments: [ref] }, 'request');
  assert.deepEqual(body.attachmentIds, ['abc']); assert.equal(body.base64, undefined);
});
test('history thumbnails are bounded while downloads preserve the original image', async () => {
  const bytes = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#007acc' } }).png().toBuffer();
  const ref = await store.saveAttachment(owner, { name: 'capture.png', base64: bytes.toString('base64') });
  const get = route('assistant/attachments/[id].ts', actor(), { '@/lib/assistant/attachment-store': store, sharp: { default: sharp } });
  const req = request('GET'); req.query = { id: ref.id, thumbnail: '1' };
  const thumbnail = response(); await get(req, thumbnail);
  const meta = await sharp(Buffer.from(thumbnail.payload.previewImage.split(',')[1], 'base64')).metadata();
  assert.equal(meta.width, 213); assert.equal(meta.height, 160); assert.equal(thumbnail.payload.base64, undefined);
  req.query.thumbnail = ''; const full = response(); await get(req, full);
  assert.equal(full.payload.base64, bytes.toString('base64'));
});
test('region geometry handles reverse drags, edge clicks and scaling without cropping', () => {
  const { normalizedRegion } = load('src/components/editor/ai-panel/attachmentFiles.ts');
  const reverse = normalizedRegion({ x: .8, y: .7 }, { x: .2, y: .1 }, 1000, 500);
  assert.equal(reverse.x, .2); assert.ok(Math.abs(reverse.width - .6) < 1e-10);
  const edge = normalizedRegion({ x: 1, y: 1 }, { x: 1, y: 1 }, 1000, 500);
  assert.ok(edge.x + edge.width <= 1); assert.ok(edge.y + edge.height <= 1);
  assert.equal(edge.width, .08); assert.equal(edge.height, .096);
});
