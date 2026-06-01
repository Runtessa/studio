import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { resolveCodexModelFromEnv } from '@/lib/assistant/codex';
import { resolveCodexGatewayBaseForUser } from '@/lib/assistant/gateway-runtime';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  const user = await requireUser(req);
  const fallback = [
    resolveCodexModelFromEnv(),
    'gpt-5.3-codex',
    'gpt-5.2-codex',
    'gpt-5-codex',
    'codex-mini-latest',
  ].filter(Boolean);

  try {
    const runtime = await resolveCodexGatewayBaseForUser(String(user.id), user.email);
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
  } catch {
    res.status(200).json({ models: fallback });
  }
});
