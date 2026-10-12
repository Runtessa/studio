import type { AssistantChange } from '@/lib/assistant/types';
import type { AssistantRunConflict, AssistantRunEvent } from '@/lib/assistant/orchestrator';
import {
  formatRunStep,
  mergeChanges,
  mergeLiveWorkspaceFiles,
  mergeProgressLines,
  mergeSteps,
  type AiMessage,
  type LiveWorkspaceFileUpdate,
} from './shared';

export type AssistantResult = {
  runId?: string;
  status?: 'running' | 'completed' | 'failed';
  pending?: boolean;
  message?: string;
  changes?: AssistantChange[];
  events?: AssistantRunEvent[];
  conflicts?: AssistantRunConflict[];
};
type StreamEvent = AssistantResult & {
  type?: string;
  content?: string;
  line?: string;
  change?: AssistantChange;
  event?: AssistantRunEvent;
  file?: LiveWorkspaceFileUpdate;
};
export type PatchMessage = (update: (message: AiMessage) => AiMessage) => void;

async function* frames(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let index: number;
      while ((index = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.replace(/^data:\s?/, ''))
          .join('\n');
        if (!data.trim()) continue;
        let event: StreamEvent;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        yield event;
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function readAssistantStream(
  body: ReadableStream<Uint8Array>,
  patch: PatchMessage,
  onRunId: (id: string) => void,
  onWorkspaceFile?: (file: LiveWorkspaceFileUpdate) => void,
): Promise<AssistantResult> {
  let failure = '';
  for await (const event of frames(body)) {
    if (event.type === 'start' && event.runId) {
      onRunId(event.runId);
      patch((message) => ({ ...message, runId: event.runId }));
    }
    if (event.type === 'delta' && event.content) {
      const content = event.content;
      patch((message) => ({ ...message, content: message.content + content }));
    }
    if (event.type === 'progress' && event.line) {
      patch((message) => ({ ...message, progress: mergeProgressLines(message.progress, event.line!) }));
    }
    if (event.type === 'run_event' && event.event) {
      const step = formatRunStep(event.event);
      patch((message) => ({
        ...message,
        events: [...(message.events || []), event.event!],
        steps: mergeSteps(message.steps, step ? [step] : []),
      }));
    }
    if (event.type === 'change' && event.change) {
      patch((message) => ({ ...message, changes: mergeChanges(message.changes, [event.change!]) }));
    }
    if (event.type === 'workspace_file' && event.file?.path) {
      const file: LiveWorkspaceFileUpdate = {
        ...event.file,
        path: String(event.file.path).trim(),
        action: event.file.action === 'create' || event.file.action === 'delete' ? event.file.action : 'edit',
      };
      patch((message) => ({ ...message, liveFiles: mergeLiveWorkspaceFiles(message.liveFiles, file) }));
      onWorkspaceFile?.(file);
    }
    if (event.type === 'error' && event.message) failure = event.message;
    if (event.type === 'done') {
      return {
        ...event,
        status: event.pending ? 'running' : failure ? 'failed' : event.status || 'completed',
        message: event.message || failure,
      };
    }
  }
  throw new Error('The assistant connection ended before completion. Recovering the recorded result.');
}
