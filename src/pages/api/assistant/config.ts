import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { CODEX_SYSTEM_INSTRUCTIONS, resolveCodexModelFromEnv } from '@/lib/assistant/codex';
import { resolveCodexGatewayBase, resolveCodexGatewayProvider } from '@/lib/assistant/gateway';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  await requireUser(req);

  const allowClientConfig = process.env.AI_ALLOW_CLIENT_CONFIG === 'true';
  const gatewayUrl = resolveCodexGatewayBase();
  const profile = {
    key: 'codex',
    label: 'Codex',
    description: 'Tenant workspace session mode through codex-gateway with scope-aware validation.',
    provider: gatewayUrl ? resolveCodexGatewayProvider() : 'codex-cli',
    model: resolveCodexModelFromEnv() ?? '',
    systemPrompt: CODEX_SYSTEM_INSTRUCTIONS,
    contextPolicy: [
      'Receives a tenant session contract with workspace files, ACL, actor access, preview exceptions, and previous-run state.',
      'Edits a hydrated tenant filesystem in codex-gateway and syncs the final diff back into the IDE.',
    ],
    supportsGatewayRuntime: true,
  } as const;

  res.status(200).json({
    agentType: 'codex',
    allowClientConfig,
    profile,
    model: profile.model,
    provider: profile.provider,
    systemPrompt: profile.systemPrompt,
    watchPreviewExceptions: false,
    supportsGatewayRuntime: profile.supportsGatewayRuntime,
  });
});
