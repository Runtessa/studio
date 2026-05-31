import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { resolveCodexModelFromEnv } from '@/lib/assistant/codex';
import { resolveCodexGatewayBaseForUser } from '@/lib/assistant/gateway-runtime';
import {
  isCodexFamilyAgentType,
  normalizeAssistantAgentType,
  resolveAssistantAgentTypeFromEnv,
} from '@/lib/assistant/agent-type';

const normalizeBaseUrl = (value?: string | null) => {
  if (!value) return '';
  return value.replace(/\/+$/, '');
};

const resolveHermesBaseUrl = () =>
  normalizeBaseUrl(process.env.HERMES_BASE_URL || process.env.AI_BASE_URL || '');

const resolveHermesApiToken = () =>
  String(process.env.HERMES_API_TOKEN || process.env.HERMES_API_KEY || process.env.AI_API_KEY || '').trim();

const resolveModelsUrl = (baseUrl: string) => {
  const trimmed = normalizeBaseUrl(baseUrl);
  if (!trimmed) return '';
  if (trimmed.endsWith('/v1')) return `${trimmed}/models`;
  return `${trimmed}/v1/models`;
};

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  await requireUser(req);

  const user = await requireUser(req);
  const envAgentType = resolveAssistantAgentTypeFromEnv('orchestrator');
  const allowClientConfig = process.env.AI_ALLOW_CLIENT_CONFIG === 'true';
  const agentType = allowClientConfig
    ? normalizeAssistantAgentType(req.query.agentType, envAgentType)
    : envAgentType;
  if (agentType === 'hermes') {
    const fallback = [
      resolveCodexModelFromEnv(agentType),
      'gpt-5.3-codex',
      'gpt-5-codex',
    ].filter(Boolean);
    const baseUrl = resolveHermesBaseUrl();
    const token = resolveHermesApiToken();
    if (!baseUrl || !token) {
      res.status(200).json({ models: fallback });
      return;
    }
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      const models = Array.isArray(data?.data)
        ? data.data
            .map((item: { id?: string }) => String(item?.id || '').trim())
            .filter(Boolean)
        : [];
      res.status(200).json({ models: models.length ? models : fallback });
      return;
    } catch {
      res.status(200).json({ models: fallback });
      return;
    }
  }

  if (isCodexFamilyAgentType(agentType)) {
    const runtime = await resolveCodexGatewayBaseForUser(String(user.id), user.email);
    const fallback = [
      resolveCodexModelFromEnv(agentType),
      'hermes-3-large',
      'hermes-3-medium',
      'gpt-5.3-codex',
      'gpt-5.2-codex',
      'gpt-5-codex',
      'codex-mini-latest',
    ].filter(Boolean);
    try {
      const response = await fetch(
        `${runtime.baseUrl}/v1/models?userId=${encodeURIComponent(String(user.id))}`
      );
      const data = await response.json().catch(() => ({}));
      const models = Array.isArray(data?.data)
        ? data.data
            .map((item: { id?: string }) => String(item?.id || '').trim())
            .filter(Boolean)
        : [];
      res.status(200).json({ models: models.length ? models : fallback });
      return;
    } catch {
      res.status(200).json({ models: fallback });
      return;
    }
  }

  const baseUrl = normalizeBaseUrl(
    (allowClientConfig ? (req.query.baseUrl as string | undefined) : undefined) ??
      process.env.AI_BASE_URL ??
      ''
  );
  const apiKey =
    (allowClientConfig ? (req.query.apiKey as string | undefined) : undefined) ??
    process.env.AI_API_KEY ??
    '';

  if (!baseUrl) {
    res.status(200).json({ models: [] });
    return;
  }

  const url = resolveModelsUrl(baseUrl);
  const response = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  });
  const data = await response.json().catch(() => ({}));
  const models = Array.isArray(data?.data)
    ? data.data.map((model: { id?: string }) => model?.id).filter(Boolean)
    : [];

  res.status(200).json({ models });
});
