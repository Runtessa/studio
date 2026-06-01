import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { resolveTenant } from '@/lib/tenancy';
import { CODEX_SYSTEM_INSTRUCTIONS } from '@/lib/assistant/codex';
import type { AssistantChange } from '@/lib/assistant/types';
import {
  buildAssistantIdempotencyKey,
  getAssistantRunSummary,
  reserveAssistantRun,
  startAssistantRun,
} from '@/lib/assistant/state-store';
import { normalizeMessages, buildRunName, createRunId } from '@/lib/assistant/respond-runtime';
import { buildAssistantRequestRuntime, type RawAssistantContext } from '@/lib/assistant/request-runtime';
import { handleCodexRun, tryRespondFromCachedRun } from '@/lib/assistant/respond-flow';


export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end();
    return;
  }

  const user = await requireUser(req);
  const tenant = await resolveTenant(req);
  const allowClientConfig = process.env.AI_ALLOW_CLIENT_CONFIG === 'true';

  const {
    messages,
    config,
    stream,
    context: rawContext,
    chatId: rawChatId,
    systemPrompt: rawSystemPrompt,
  } = req.body ?? {};

  const chatId =
    typeof rawChatId === 'string' && rawChatId.trim()
      ? rawChatId.trim().slice(0, 128)
      : 'default';

  const normalizedMessages = normalizeMessages(messages);
  if (!normalizedMessages.length) {
    const err = new Error('Messages are required');
    (err as any).statusCode = 400;
    throw err;
  }

  const changes: AssistantChange[] = [];
  const context =
    rawContext && typeof rawContext === 'object'
      ? (rawContext as RawAssistantContext)
      : null;

  const { tools, workspace, session, contextText } = await buildAssistantRequestRuntime({
    tenant,
    user,
    chatId,
    messages: normalizedMessages,
    context,
    changes,
  });

  const runId = createRunId(chatId);

  const idempotency = buildAssistantIdempotencyKey(normalizedMessages, contextText);
  const existingRunSummary = await getAssistantRunSummary(tenant.id, runId);
  const runName = existingRunSummary?.runName || buildRunName(normalizedMessages);
  const reservation = await reserveAssistantRun(tenant.id, runId, idempotency);

  if (reservation.reusedRunId) {
    const handled = await tryRespondFromCachedRun({
      tenantId: tenant.id,
      runId,
      reusedRunId: reservation.reusedRunId,
      stream: Boolean(stream),
      res,
      changes,
    });
    if (handled) return;
  }

  await startAssistantRun(tenant.id, runId, { idempotency, runName });

  await handleCodexRun({
    req,
    res,
    tenantId: tenant.id,
    userId: user.id,
    userName: user.email,
    chatId,
    runId,
    runName,
    idempotency,
    stream: Boolean(stream),
    rawSystemPrompt,
    config,
    allowClientConfig,
    messages: normalizedMessages,
    contextText,
    session,
    tools: tools as Record<string, unknown>,
    workspace,
    changes,
    codexSystemPrompt: CODEX_SYSTEM_INSTRUCTIONS,
  });
});
