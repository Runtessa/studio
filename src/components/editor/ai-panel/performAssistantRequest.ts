import type { AssistantChange } from '@/lib/assistant/types';
import { readAssistantStream, type AssistantResult, type PatchMessage } from './assistantStream';
import {
  mapRunSteps,
  mergeChanges,
  normalizeAssistantMessage,
  type ApiStreamFetch,
  type LiveWorkspaceFileUpdate,
} from './shared';

export type WorkspaceRefresh = (
  changes?: AssistantChange[],
  options?: { preserveBuffers?: boolean },
) => void | Promise<void>;
export async function performAssistantRequest(input: {
  apiStreamFetch: ApiStreamFetch;
  body: Record<string, unknown>;
  signal: AbortSignal;
  patch: PatchMessage;
  onRunId: (id: string) => void;
  onLiveWorkspaceFileUpdate?: (file: LiveWorkspaceFileUpdate) => void;
  onLiveWorkspaceRunStateChange?: (state: 'started' | 'committed' | 'reverted') => void;
  onWorkspaceRefresh: WorkspaceRefresh;
  loadRuns: () => void | Promise<void>;
  success: (message: string) => void;
  showError: (message: string) => void;
}) {
  const response = await input.apiStreamFetch('/api/assistant/respond', {
    method: 'POST',
    body: input.body,
    signal: input.signal,
  });
  const result: AssistantResult =
    response.body && response.headers.get('content-type')?.includes('text/event-stream')
      ? await readAssistantStream(response.body, input.patch, input.onRunId, input.onLiveWorkspaceFileUpdate)
      : await response.json();
  if (result.runId) input.onRunId(result.runId);
  if (result.pending || result.status === 'running') {
    input.patch((message) => ({ ...message, runId: result.runId || message.runId, status: 'running' }));
    input.onLiveWorkspaceRunStateChange?.('reverted');
    return;
  }
  const failed = result.status === 'failed' || !response.ok;
  input.patch((message) => ({
    ...message,
    runId: result.runId || message.runId,
    status: failed ? 'failed' : 'completed',
    content: normalizeAssistantMessage(result.message || (failed ? 'Assistant request failed.' : 'Done.')),
    changes: mergeChanges(message.changes, result.changes || []),
    events: result.events || message.events,
    steps: mapRunSteps(result.events || message.events || []),
    conflicts: result.conflicts || message.conflicts,
  }));
  input.onLiveWorkspaceRunStateChange?.(failed ? 'reverted' : 'committed');
  // A stopped or failed run can still have applied changes. Show them accurately.
  if (result.changes?.length) await input.onWorkspaceRefresh(result.changes);
  await input.loadRuns();
  if (failed) input.showError(result.message || 'Assistant request failed.');
  else input.success(result.changes?.length ? 'Assistant updated the workspace' : 'Assistant finished');
}
