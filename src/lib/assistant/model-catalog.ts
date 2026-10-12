import { resolveCodexGatewayBaseForUser } from './gateway-runtime';
import { resolveCodexModelFromEnv } from './codex';

export type CodexModelCatalog = { models: string[]; defaultModel: string };

export const loadCodexModelCatalog = async (
  userId: string | number,
  userName?: string,
): Promise<CodexModelCatalog> => {
  const runtime = await resolveCodexGatewayBaseForUser(userId, userName);
  let response: Response;
  try {
    response = await fetch(
      `${runtime.baseUrl}/v1/models?userId=${encodeURIComponent(String(userId))}`,
      {
        signal: AbortSignal.timeout(20000),
      },
    );
  } catch {
    throw new Error(
      'Codex is unavailable. Start the assistant gateway and check its connection in Agent settings.',
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || 'Could not load Codex models');
  const models: string[] = Array.isArray(data.data)
    ? [
        ...new Set<string>(
          data.data
            .map((item: { id?: string }) => String(item?.id || '').trim())
            .filter(Boolean),
        ),
      ]
    : [];
  if (!models.length) throw new Error('Codex returned no available models');
  const configured = resolveCodexModelFromEnv();
  return {
    models,
    defaultModel:
      configured || String(data.defaultModel || '').trim() || models[0],
  };
};
