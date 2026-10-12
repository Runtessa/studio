import type { AiMessage, AiSettings } from './shared';

export type StoredAssistantChat = {
  messages?: AiMessage[];
  chatSessionId?: string;
  settings?: Partial<AiSettings>;
  promptOverride?: string;
};
export function readOwnedAssistantChat(
  storage: Pick<Storage, 'getItem'>,
  prefix: string,
  tenant: string,
  actor: { userId: string; isAdmin: boolean },
) {
  if (!actor.userId) throw new Error('Assistant account identity is unavailable. Reload before sending.');
  const key = `${prefix}:user:${encodeURIComponent(actor.userId)}:${tenant}`;
  // Old tenant-only history has no reliable owner. Preserve it on disk and
  // import it only for administrators who can access legacy server history.
  const raw = storage.getItem(key) ?? (actor.isAdmin ? storage.getItem(`${prefix}:${tenant}`) : null);
  let chat: StoredAssistantChat = {};
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) chat = parsed;
  } catch {
    /* Keep malformed legacy data intact; start a clean owned session. */
  }
  return { key, chat };
}
