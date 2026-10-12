import redis from '@/lib/redis';
import { activeRunKey } from './run-control';
import {
  completeAssistantRun,
  getAssistantChangeCheckpoint,
  getAssistantRun,
  type AssistantRunSummary,
} from './state-store';

// A server restart cannot leave the UI waiting forever. Active workers renew a
// separate lease, including read-only workers that do not own the writer lock.
export async function recoverInterruptedRun(tenantId: string, summary: AssistantRunSummary) {
  const age = Date.now() - Date.parse(summary.createdAt);
  if (
    summary.status !== 'running' ||
    !Number.isFinite(age) ||
    age < 90000 ||
    (await redis.get(activeRunKey(tenantId, summary.runId)))
  )
    return null;
  // Recheck final storage after checking the lease to avoid replacing a just
  // completed response with an interruption result.
  const completed = await getAssistantRun(tenantId, summary.runId);
  if (completed) return completed;
  const changes = await getAssistantChangeCheckpoint(tenantId, summary.runId);
  const result = {
    ...summary,
    tenantId,
    userId: summary.userId,
    chatId: summary.chatId,
    status: 'failed' as const,
    updatedAt: new Date().toISOString(),
    message: 'This run was interrupted. Review saved changes before retrying.',
    finishReason: 'assistant-worker-interrupted',
    changes,
    events: [],
    artifacts: [],
    dag: { nodes: [], edges: [] },
    conflicts: [],
  };
  await completeAssistantRun(result);
  return result;
}
