import type { NextApiRequest, NextApiResponse } from 'next';
import {
  appendAssistantEvent,
  completeAssistantRun,
  getAssistantRun,
  getAssistantRunSummary,
} from '@/lib/assistant/state-store';
import type { AssistantChange } from '@/lib/assistant/types';
import type { AgentWorkspaceSession, WorkspaceContext } from '@/lib/assistant/respond-runtime';
import {
  executeCodexPipeline,
  normalizeSystemPrompt,
  resolveCodexModel,
} from '@/lib/assistant/respond-runtime';
import { commitCodexGatewayWorkspace, resetCodexGatewayWorkspace } from '@/lib/assistant/gateway-workspace';
import type { WorkspaceFileEvent } from '@/lib/assistant/respond-runtime/codex-client';

const openSse = (res: NextApiResponse) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  (res as any).flushHeaders?.();
};

const sendSse = (res: NextApiResponse, payload: Record<string, unknown>) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const normalizeWorkspaceFileEvent = (event: WorkspaceFileEvent) => ({
  path: String(event.path || '').trim(),
  action: event.action === 'create' || event.action === 'delete' ? event.action : 'edit',
  content: typeof event.content === 'string' ? event.content : undefined,
});

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

type CodexRunParams = {
  req: NextApiRequest;
  res: NextApiResponse;
  tenantId: string;
  userId: string | number;
  userName?: string;
  chatId: string;
  runId: string;
  runName: string;
  idempotency: string;
  stream: boolean;
  rawSystemPrompt: unknown;
  config: unknown;
  allowClientConfig: boolean;
  messages: Array<{ role: string; content: string }>;
  contextText: string;
  session: AgentWorkspaceSession;
  tools: Record<string, unknown>;
  workspace: WorkspaceContext;
  changes: AssistantChange[];
  codexSystemPrompt: string;
};

export const handleCodexRun = async ({
  req,
  res,
  tenantId,
  userId,
  userName,
  chatId,
  runId,
  runName,
  idempotency,
  stream,
  rawSystemPrompt,
  config,
  allowClientConfig,
  messages,
  contextText,
  session,
  tools,
  workspace,
  changes,
  codexSystemPrompt,
}: CodexRunParams): Promise<void> => {
  const systemPrompt = normalizeSystemPrompt(rawSystemPrompt, codexSystemPrompt);
  const codexModel = resolveCodexModel((config ?? {}) as { model?: string }, allowClientConfig);

  const syncGatewayWorkspace = async (action: 'commit' | 'reset') => {
    if (!session?.tenant?.id) return;
    try {
      if (action === 'commit') {
        await commitCodexGatewayWorkspace({
          userId,
          userName,
          chatId,
          tenantId: session.tenant.id,
        });
        return;
      }
      await resetCodexGatewayWorkspace({
        userId,
        userName,
        chatId,
        tenantId: session.tenant.id,
      });
    } catch {
      // keep run result authoritative; gateway workspace can be repaired on next activation
    }
  };

  const completePipeline = async (pipeline: Awaited<ReturnType<typeof executeCodexPipeline>>) => {
    const now = new Date().toISOString();
    await completeAssistantRun({
      runId,
      tenantId,
      runName,
      status: pipeline.status,
      message: pipeline.message,
      finishReason: pipeline.finishReason,
      usage: pipeline.usage,
      createdAt: pipeline.events[0]?.timestamp ?? now,
      updatedAt: now,
      idempotencyKey: idempotency,
      events: pipeline.events,
      changes: pipeline.changes,
      artifacts: pipeline.artifacts,
      dag: pipeline.dag,
      conflicts: pipeline.conflicts,
    });
  };

  if (stream) {
    openSse(res);
    sendSse(res, { type: 'start', runId });
    const pipeline = await executeCodexPipeline({
      runId,
      userId,
      userName,
      chatId,
      messages,
      contextText,
      session,
      systemPrompt,
      model: codexModel,
      tools: tools as Record<string, any>,
      workspace,
      changes,
      onProgress: (line) => sendSse(res, { type: 'progress', line }),
      onChange: (change) => sendSse(res, { type: 'change', change }),
      onWorkspaceFile: (event) =>
        sendSse(res, { type: 'workspace_file', file: normalizeWorkspaceFileEvent(event) }),
      onEvent: (event) => {
        sendSse(res, { type: 'run_event', event });
        void appendAssistantEvent(tenantId, runId, event).catch(() => undefined);
      },
    });
    await completePipeline(pipeline);
    await syncGatewayWorkspace(pipeline.status === 'completed' ? 'commit' : 'reset');

    if (pipeline.status === 'failed') {
      sendSse(res, {
        type: 'error',
        message:
          pipeline.conflicts[0]?.message ||
          pipeline.message ||
          `Codex pipeline failed (${pipeline.finishReason || 'unknown reason'})`,
      });
    }
    sendSse(res, {
      type: 'done',
      message: pipeline.message,
      changes: pipeline.changes,
      finishReason: pipeline.finishReason,
      runId,
      usage: pipeline.usage,
      events: pipeline.events,
      dag: pipeline.dag,
      conflicts: pipeline.conflicts,
    });
    res.end();
    return;
  }

  const pipeline = await executeCodexPipeline({
    runId,
    userId,
    userName,
    chatId,
    messages,
    contextText,
    session,
    systemPrompt,
    model: codexModel,
    tools: tools as Record<string, any>,
    workspace,
    changes,
    onEvent: (event) => {
      void appendAssistantEvent(tenantId, runId, event).catch(() => undefined);
    },
  });
  await completePipeline(pipeline);
  await syncGatewayWorkspace(pipeline.status === 'completed' ? 'commit' : 'reset');
  if (pipeline.status === 'failed') {
    throw new Error(pipeline.conflicts[0]?.message || pipeline.message || 'Codex execution failed');
  }
  res.status(200).json({
    message: pipeline.message,
    changes: pipeline.changes,
    finishReason: pipeline.finishReason,
    runId,
    usage: pipeline.usage,
    events: pipeline.events,
    dag: pipeline.dag,
    conflicts: pipeline.conflicts,
  });
};
