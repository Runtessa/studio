import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { resolveTenant } from '@/lib/tenancy';
import { normalizeMessages, type AgentWorkspaceSession } from '@/lib/assistant/respond-runtime';
import { buildAssistantRequestRuntime, type RawAssistantContext } from '@/lib/assistant/request-runtime';
import { activateCodexGatewayWorkspace } from '@/lib/assistant/gateway-workspace';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end();
    return;
  }

  const user = await requireUser(req);
  const tenant = await resolveTenant(req);
  const rawChatId = String(req.body?.chatId || '').trim();
  const chatId = rawChatId ? rawChatId.slice(0, 128) : 'default';
  const messages = normalizeMessages(req.body?.messages ?? []);
  const rawContext = req.body?.context;
  const context = rawContext && typeof rawContext === 'object'
    ? (rawContext as RawAssistantContext)
    : null;

  const { session } = await buildAssistantRequestRuntime({
    tenant,
    user,
    chatId,
    messages,
    context,
    changes: [],
  });

  const activation = await activateCodexGatewayWorkspace({
    userId: user.id,
    userName: user.email,
    chatId,
    tenantId: tenant.id,
    session,
  });

  res.status(200).json({
    ok: true,
    chatId,
    workspace: activation.workspace,
  });
});
