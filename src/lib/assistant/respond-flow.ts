import type { CodexRunParams } from './respond-run-types';
import {
  appendAssistantEvent,
  completeAssistantRun,
  checkpointAssistantChanges,
} from '@/lib/assistant/state-store';
import type { WorkspaceContext } from '@/lib/assistant/respond-runtime';
import {
  executeCodexPipeline,
  normalizeSystemPrompt,
  resolveCodexModel,
} from '@/lib/assistant/respond-runtime';
import { syncAssistantWorkspace } from './run-workspace-sync';
import { openSse, sendSse } from './respond-cached';
export { tryRespondFromCachedRun } from './respond-cached';
import { createAssistantRunControl } from './run-control';
import { assertWorkspacePreconditions } from './respond-runtime/workspace-preconditions';
import { executeTool } from './respond-runtime/codex-types';
import type { CodexOperation } from './respond-runtime/codex-types';
import { sharedWriteResources } from './respond-runtime/shared-write-resources';
import { overlayOwnChanges } from './respond-runtime/workspace-overlay';

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
  attachments,
  contextText,
  session,
  tools,
  workspace,
  changes,
  codexSystemPrompt,
}: CodexRunParams): Promise<void> => {
  const systemPrompt = normalizeSystemPrompt(rawSystemPrompt, codexSystemPrompt);
  const codexModel = resolveCodexModel((config ?? {}) as { model?: string }, allowClientConfig);

  const syncGatewayWorkspace = (action: 'commit' | 'reset') =>
    session.tenant?.id ? syncAssistantWorkspace({ userId, userName, chatId, tenantId: session.tenant.id }, action) : Promise.resolve();

  const completePipeline = async (pipeline: Awaited<ReturnType<typeof executeCodexPipeline>>) => {
    const now = new Date().toISOString();
    await completeAssistantRun({
      runId,
      tenantId,
      runName,
      chatId,
      userId: String(userId),
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

  const control = await createAssistantRunControl({
    tenantId,
    runId,
    req,
    res,
    readOnly: session.task.expectations.mode === 'read-only',
  }).catch(async (error) => {
    const now = new Date().toISOString();
    await completeAssistantRun({
      tenantId,
      runId,
      chatId,
      userId: String(userId),
      runName,
      status: 'failed',
      message: error.message,
      finishReason: error.code || 'assistant-start-failed',
      idempotencyKey: idempotency,
      createdAt: now,
      updatedAt: now,
      events: [],
      changes: [],
      artifacts: [],
      dag: { nodes: [], edges: [] },
      conflicts: [],
    });
    throw error;
  });
  let writes = Promise.resolve();
  const recordEvent = (event: Parameters<typeof appendAssistantEvent>[2]) => {
    writes = writes.then(() => appendAssistantEvent(tenantId, runId, event));
    void writes.catch(() => undefined);
  };
  const beforeApply = async (operations: CodexOperation[]) => {
    const { expected } = overlayOwnChanges(workspace, session.acl as Record<string, unknown>, changes);
    await control.acquireResources(sharedWriteResources(operations, expected));
    await control.assertOwnership();
    const [current, currentAcl] = await Promise.all([
      executeTool<WorkspaceContext, {}>((tools as any).list_workspace, {}),
      executeTool<Record<string, unknown>, {}>((tools as any).get_acl_config, {}),
    ]);
    assertWorkspacePreconditions({
      baseline: workspace,
      baselineAcl: session.acl as Record<string, unknown>,
      current,
      currentAcl,
      operations,
      appliedChanges: changes,
    });
  };
  const heartbeat = stream
    ? setInterval(() => {
        if (!res.destroyed && !res.writableEnded) res.write(': keepalive\n\n');
      }, 15000)
    : undefined;
  try {
    if (stream) {
      openSse(res);
      sendSse(res, { type: 'start', runId });
    }
    const pipeline = await executeCodexPipeline({
      runId,
      userId,
      userName,
      chatId,
      messages,
      attachments,
      contextText,
      session,
      systemPrompt,
      model: codexModel,
      tools: tools as Record<string, any>,
      workspace,
      changes,
      signal: control.signal,
      beforeApply,
      onDelta: stream ? (content) => sendSse(res, { type: 'delta', content }) : undefined,
      onProgress: stream ? (line) => sendSse(res, { type: 'progress', line }) : undefined,
      onChange: (change) => {
        if (stream) sendSse(res, { type: 'change', change });
        const saved = [...changes];
        writes = writes
          .catch(() => undefined)
          .then(() => checkpointAssistantChanges(tenantId, runId, saved))
          .then(() => undefined);
        void writes.catch(() => undefined);
      },
      onWorkspaceFile: stream ? (file) => sendSse(res, { type: 'workspace_file', file }) : undefined,
      onEvent: (event) => {
        if (stream) sendSse(res, { type: 'run_event', event });
        recordEvent(event);
      },
    });
    // The final payload contains the ordered event list even when a transient
    // event append failed. Persist that authoritative result before reporting it.
    await writes.catch(() => undefined);
    await completePipeline(pipeline);
    await syncGatewayWorkspace(pipeline.status === 'completed' ? 'commit' : 'reset');
    const result = { ...pipeline, runId };
    if (stream) {
      sendSse(res, { type: 'done', ...result });
      res.end();
    } else res.status(200).json(result);
  } catch (error) {
    await syncGatewayWorkspace('reset');
    const message = changes.length
      ? 'Some changes were saved, but the run could not be recorded. Reload and review the saved files before retrying.'
      : 'The assistant could not record this run. Reload and check its status before retrying.';
    const failure = {
      runId,
      status: 'failed',
      message,
      changes,
      finishReason: 'assistant-persistence-failed',
    };
    if (stream) {
      sendSse(res, { type: 'done', ...failure });
      res.end();
    } else res.status(503).json(failure);
  } finally {
    clearInterval(heartbeat);
    await control.dispose();
  }
};
