import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { CODEX_SYSTEM_INSTRUCTIONS, resolveCodexModelFromEnv } from '@/lib/assistant/codex';
import { ASSISTANT_SYSTEM_INSTRUCTIONS } from '@/lib/assistant/agent';
import { resolveCodexGatewayBase, resolveCodexGatewayProvider } from '@/lib/assistant/gateway';
import { resolveAssistantAgentTypeFromEnv } from '@/lib/assistant/agent-type';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  await requireUser(req);

  const agentType = resolveAssistantAgentTypeFromEnv('orchestrator');
  const allowClientConfig = process.env.AI_ALLOW_CLIENT_CONFIG === 'true';
  const gatewayUrl = resolveCodexGatewayBase();
  const codexProvider = gatewayUrl ? resolveCodexGatewayProvider() : 'codex-cli';
  const hermesBaseUrl = String(process.env.HERMES_BASE_URL || process.env.AI_BASE_URL || '').trim();
  const hermesToken = String(
    process.env.HERMES_API_TOKEN || process.env.HERMES_API_KEY || process.env.AI_API_KEY || ''
  ).trim();

  const profiles = {
    orchestrator: {
      key: 'orchestrator',
      label: 'Orchestrator',
      description: 'Legacy tool-calling assistant path with direct host tool access.',
      provider: process.env.AI_PROVIDER ?? '',
      model: process.env.AI_MODEL ?? '',
      systemPrompt: ASSISTANT_SYSTEM_INSTRUCTIONS,
      contextPolicy: [
        'Inspect-first tool flow.',
        'Relies on tool calls rather than a tenant session contract.',
      ],
      supportsGatewayRuntime: false,
      supportsDirectProviderConfig: true,
    },
    codex: {
      key: 'codex',
      label: 'Codex',
      description: 'Tenant workspace session mode through codex-gateway with scope-aware validation.',
      provider: codexProvider,
      model: resolveCodexModelFromEnv('codex') ?? '',
      systemPrompt: CODEX_SYSTEM_INSTRUCTIONS,
      contextPolicy: [
        'Receives a tenant session contract with workspace files, ACL, actor access, preview exceptions, and previous-run state.',
        'Returns JSON operations for host execution; no direct tool calls from the model.',
      ],
      supportsGatewayRuntime: true,
      supportsDirectProviderConfig: false,
    },
    hermes: {
      key: 'hermes',
      label: 'Hermes',
      description: 'Codex-style host contract executed against an OpenAI-compatible provider.',
      provider: 'hermes',
      model: String(resolveCodexModelFromEnv('hermes') || process.env.HERMES_MODEL || '').trim(),
      systemPrompt: CODEX_SYSTEM_INSTRUCTIONS,
      contextPolicy: [
        'Uses the same tenant session contract as Codex mode.',
        'Executes against configured Hermes/OpenAI-compatible chat completions.',
      ],
      supportsGatewayRuntime: false,
      supportsDirectProviderConfig: true,
    },
  } as const;

  const activeProfile = profiles[agentType];
  const hasApiKey =
    agentType === 'hermes'
      ? Boolean(hermesToken)
      : agentType === 'codex'
        ? false
        : Boolean(process.env.AI_API_KEY);
  const baseUrl =
    agentType === 'hermes' ? hermesBaseUrl : agentType === 'orchestrator' ? process.env.AI_BASE_URL ?? '' : '';

  res.status(200).json({
    defaultAgentType: agentType,
    agentType,
    allowClientConfig,
    profiles,
    baseUrl,
    model: activeProfile.model,
    provider: activeProfile.provider,
    hasApiKey,
    systemPrompt: activeProfile.systemPrompt,
    watchPreviewExceptions: false,
    supportsGatewayRuntime: activeProfile.supportsGatewayRuntime,
    supportsDirectProviderConfig: activeProfile.supportsDirectProviderConfig,
  });
});
