import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { recoverAssistantMessages } from './recoverRuns';
import type { AiMessage, ApiFetch } from './shared';
import type { WorkspaceRefresh } from './performAssistantRequest';

export function useRecoverRuns(input: {
  sending: boolean;
  chatSessionId: string;
  messages: AiMessage[];
  apiFetch?: ApiFetch;
  setMessages: Dispatch<SetStateAction<AiMessage[]>>;
  onWorkspaceRefresh: WorkspaceRefresh;
  loadRuns: () => void | Promise<void>;
}) {
  const latest = useRef(input);
  latest.current = input;
  const key = input.messages
    .filter((message) => message.runId && message.status === 'running')
    .map((message) => message.id)
    .join(',');
  useEffect(() => {
    if (input.sending || !key || !input.apiFetch) return;
    let cancelled = false,
      inFlight = false;
    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const current = latest.current;
        const recovered = await recoverAssistantMessages(current.messages, current.apiFetch!);
        if (cancelled || !recovered.size) return;
        current.setMessages((messages) =>
          messages.map((message) =>
            recovered.has(message.id) ? { ...message, ...recovered.get(message.id) } : message,
          ),
        );
        const changes = [...recovered.values()].flatMap((run) => run.changes || []);
        if (changes.length) await current.onWorkspaceRefresh(changes, { preserveBuffers: true });
        await current.loadRuns();
      } catch {
        /* A temporary network failure keeps the pending run recoverable. */
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [input.sending, key, input.chatSessionId, input.apiFetch]);
}
