import type { NextApiResponse } from 'next';
import { getAssistantRun, getAssistantRunSummary } from './state-store';
import type { AssistantChange } from './types';

export const openSse = (res: NextApiResponse) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  (res as any).flushHeaders?.();
};

export const sendSse = (res: NextApiResponse, payload: Record<string, unknown>) => {
  if (res.destroyed || res.writableEnded) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

type CachedRunParams = {
  tenantId: string;
  runId: string;
  reusedRunId: string;
  stream: boolean;
  res: NextApiResponse;
  changes: AssistantChange[];
};

export const tryRespondFromCachedRun = async ({
  tenantId,
  runId,
  reusedRunId,
  stream,
  res,
  changes,
}: CachedRunParams): Promise<boolean> => {
  const cached = await getAssistantRun(tenantId, reusedRunId);
  if (cached) {
    if (stream) {
      openSse(res);
      sendSse(res, { type: 'start', runId: cached.runId });
      sendSse(res, {
        type: 'done',
        message: cached.message,
        status: cached.status,
        changes: Array.isArray((cached as any).changes) ? (cached as any).changes : [],
        finishReason: cached.finishReason,
        runId: cached.runId,
        usage: cached.usage,
        events: cached.events,
        dag: cached.dag,
        conflicts: cached.conflicts,
        cached: true,
      });
      res.end();
      return true;
    }
    res.status(200).json({
      message: cached.message,
      status: cached.status,
      changes: Array.isArray((cached as any).changes) ? (cached as any).changes : [],
      finishReason: cached.finishReason,
      runId: cached.runId,
      usage: cached.usage,
      events: cached.events,
      dag: cached.dag,
      conflicts: cached.conflicts,
      cached: true,
    });
    return true;
  }

  const summary = await getAssistantRunSummary(tenantId, reusedRunId);
  if (summary?.status === 'running') {
    if (stream) {
      openSse(res);
      sendSse(res, { type: 'start', runId: reusedRunId });
      sendSse(res, {
        type: 'done',
        message: 'Equivalent run is already in progress. Retry in a few seconds.',
        changes,
        runId: reusedRunId,
        pending: true,
      });
      res.end();
      return true;
    }
    res.status(202).json({
      message: 'Equivalent run is already in progress. Retry in a few seconds.',
      runId: reusedRunId,
      pending: true,
    });
    return true;
  }

  return false;
};
