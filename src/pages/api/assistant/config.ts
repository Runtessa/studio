import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { CODEX_SYSTEM_INSTRUCTIONS, resolveCodexModelFromEnv } from '@/lib/assistant/codex';
import { ASSISTANT_SYSTEM_INSTRUCTIONS } from '@/lib/assistant/agent';
import { resolveCodexGatewayBase, resolveCodexGatewayProvider } from '@/lib/assistant/gateway';
import {
  isCodexFamilyAgentType,
  resolveAssistantAgentTypeFromEnv,
} from '@/lib/assistant/agent-type';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  await requireUser(req);

  const agentType = resolveAssistantAgentTypeFromEnv('orchestrator');
  const allowClientConfig = process.env.AI_ALLOW_CLIENT_CONFIG === 'true';
  if (isCodexFamilyAgentType(agentType)) {
    const hermesBaseUrl = String(process.env.HERMES_BASE_URL || process.env.AI_BASE_URL || '').trim();
    const hermesToken = String(
      process.env.HERMES_API_TOKEN || process.env.HERMES_API_KEY || process.env.AI_API_KEY || ''
    ).trim();
    const model =
      agentType === 'hermes'
        ? String(resolveCodexModelFromEnv(agentType) || process.env.HERMES_MODEL || '').trim()
        : resolveCodexModelFromEnv(agentType) ?? '';
    const gatewayUrl = resolveCodexGatewayBase();
    res.status(200).json({
      agentType,
      allowClientConfig,
      baseUrl: agentType === 'hermes' ? hermesBaseUrl : '',
      model,
      provider:
        agentType === 'hermes'
          ? 'hermes'
          : gatewayUrl
            ? resolveCodexGatewayProvider()
            : 'codex-cli',
      hasApiKey: agentType === 'hermes' ? Boolean(hermesToken) : false,
      systemPrompt: CODEX_SYSTEM_INSTRUCTIONS,
      watchPreviewExceptions: false,
    });
    return;
  }

  res.status(200).json({
    agentType,
    allowClientConfig,
    baseUrl: process.env.AI_BASE_URL ?? '',
    model: process.env.AI_MODEL ?? '',
    provider: process.env.AI_PROVIDER ?? '',
    hasApiKey: Boolean(process.env.AI_API_KEY),
    systemPrompt: ASSISTANT_SYSTEM_INSTRUCTIONS,
    watchPreviewExceptions: false,
  });
});
