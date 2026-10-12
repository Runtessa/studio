import { randomUUID } from 'node:crypto';
import redis from '@/lib/redis';
import { attachmentError, validateAttachment } from './attachment-validation';
import { ATTACHMENT_TTL_SECONDS, MAX_ATTACHMENTS, MAX_TURN_BYTES, type AttachmentContent } from './attachment-types';

type Owner = { userId: number | string; tenantId: string };
const scope = (owner: Owner) => `assistant:attachments:${encodeURIComponent(owner.tenantId)}:${encodeURIComponent(owner.userId)}`;
const key = (owner: Owner, id: string) => `${scope(owner)}:${id}`;
const validId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id);
const STORE_SCRIPT = `
local total, count = 0, 0
local entries = redis.call('hgetall', KEYS[2])
for i = 1, #entries, 2 do
  local size, expiry = string.match(entries[i+1], '^(%d+):(%d+)$')
  if not expiry or tonumber(expiry) <= tonumber(ARGV[4]) then redis.call('hdel', KEYS[2], entries[i])
  else total = total + tonumber(size); count = count + 1 end
end
if count >= 64 or total + tonumber(ARGV[3]) > 104857600 then return 0 end
redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
redis.call('hset', KEYS[2], ARGV[5], ARGV[3] .. ':' .. (tonumber(ARGV[4]) + tonumber(ARGV[2])))
redis.call('expire', KEYS[2], ARGV[2])
return 1`;

export async function saveAttachment(owner: Owner, raw: unknown) {
  const record: AttachmentContent = { id: randomUUID(), ...await validateAttachment(raw) };
  const saved = await redis.eval(STORE_SCRIPT, 2, key(owner, record.id), `${scope(owner)}:quota`,
    JSON.stringify(record), ATTACHMENT_TTL_SECONDS, record.size, Math.floor(Date.now() / 1000), record.id);
  if (!saved) attachmentError('Attachment storage is full. Remove unused attachments or try again later.', 429);
  const { base64: _content, ...attachment } = record;
  return attachment;
}
export async function readAttachment(owner: Owner, id: unknown): Promise<AttachmentContent> {
  if (!validId(id)) attachmentError('Attachment not found or expired. Attach the file again.', 404);
  const raw = await redis.get(key(owner, id));
  if (!raw) attachmentError('Attachment not found or expired. Attach the file again.', 404);
  return JSON.parse(raw);
}
export async function removeAttachment(owner: Owner, id: unknown) {
  await readAttachment(owner, id);
  await redis.del(key(owner, id as string));
  await redis.hdel(`${scope(owner)}:quota`, id as string);
}
export async function resolveAttachments(owner: Owner, raw: unknown): Promise<AttachmentContent[]> {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_ATTACHMENTS || raw.some(id => !validId(id)) || new Set(raw).size !== raw.length)
    attachmentError('Attach up to five different files per message');
  const attachments = await Promise.all(raw.map(id => readAttachment(owner, id)));
  if (attachments.reduce((sum, file) => sum + file.size, 0) > MAX_TURN_BYTES)
    attachmentError('Attachments must total at most 10 MB per message', 413);
  return attachments;
}
