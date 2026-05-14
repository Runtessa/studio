import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { hasContainerOrchestrator, inspectContainer } from '@/lib/container-orchestrator-client';

const firstString = (value: string | string[] | undefined) =>
  Array.isArray(value) ? String(value[0] || '') : String(value || '');

type InspectPayload = {
  ok?: boolean;
  containerName?: string;
  inspect?: Record<string, unknown>;
};

const resolveTargetAgent = (req: NextApiRequest) => {
  const fromQuery = firstString(req.query.agentId).trim();
  return fromQuery || String(process.env.AGENT_CONTAINER_MANAGER_TARGET || '').trim() || undefined;
};

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  await requireAdmin(req);

  if (!hasContainerOrchestrator()) {
    res.status(400).json({
      ok: false,
      error: 'Container orchestrator is not configured',
    });
    return;
  }

  const containerName = firstString(req.query.containerName).trim();
  if (!containerName) {
    res.status(400).json({ ok: false, error: 'containerName is required' });
    return;
  }

  const data = (await inspectContainer(
    { containerName },
    resolveTargetAgent(req)
  )) as InspectPayload;

  res.status(200).json({
    ok: true,
    containerName: String(data?.containerName || containerName),
    inspect: data?.inspect || null,
  });
});
