import type { AiMessage, ApiFetch } from './shared';
import { mapRunSteps, normalizeAssistantMessage } from './shared';

export async function recoverAssistantMessages(messages: AiMessage[], apiFetch: ApiFetch) {
  const recovered = new Map<string, Partial<AiMessage>>();
  for (const message of messages) {
    if (message.role !== 'assistant' || !message.runId || message.status !== 'running') continue;
    try {
      const run = await apiFetch(`/api/assistant/runs/${encodeURIComponent(message.runId)}`);
      if (run.pending || run.status === 'running') continue;
      recovered.set(message.id, {
        content: normalizeAssistantMessage(run.message || 'Assistant finished.'),
        status: run.status === 'completed' ? 'completed' : 'failed',
        changes: run.changes || [],
        events: run.events || [],
        steps: mapRunSteps(run.events || []),
        conflicts: run.conflicts || [],
      });
    } catch {
      // A transient network error must not discard a recoverable running message.
    }
  }
  return recovered;
}
