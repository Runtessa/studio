import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { hasContainerOrchestrator, listContainers } from '@/lib/container-orchestrator-client';

const firstString = (value: string | string[] | undefined) =>
  Array.isArray(value) ? String(value[0] || '') : String(value || '');

const isTruthy = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

type ListPayload = {
  ok?: boolean;
  managedOnly?: boolean;
  total?: number;
  containers?: Array<Record<string, unknown>>;
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

  const managedOnly = isTruthy(firstString(req.query.managedOnly || 'true'));
  const service = firstString(req.query.service || '').trim();
  const search = firstString(req.query.search || '').trim();
  const data = (await listContainers(
    {
      managedOnly,
      ...(service ? { service } : {}),
      ...(search ? { search } : {}),
    },
    resolveTargetAgent(req)
  )) as ListPayload;

  res.status(200).json({
    ok: true,
    managedOnly: Boolean(data?.managedOnly),
    total: Number(data?.total || 0),
    containers: Array.isArray(data?.containers) ? data?.containers : [],
  });
});
