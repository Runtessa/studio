import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { getContainerLogs, hasContainerOrchestrator } from '@/lib/container-orchestrator-client';

const firstString = (value: string | string[] | undefined) =>
  Array.isArray(value) ? String(value[0] || '') : String(value || '');

type LogsPayload = {
  ok?: boolean;
  containerName?: string;
  tail?: number;
  logs?: string;
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

  const tailRaw = Number(firstString(req.query.tail || '200'));
  const tail = Number.isFinite(tailRaw) ? Math.min(Math.max(Math.floor(tailRaw), 1), 5000) : 200;
  const sinceRaw = Number(firstString(req.query.since || '0'));
  const since = Number.isFinite(sinceRaw) ? Math.max(Math.floor(sinceRaw), 0) : 0;
  const data = (await getContainerLogs(
    {
      containerName,
      tail,
      ...(since > 0 ? { since } : {}),
    },
    resolveTargetAgent(req)
  )) as LogsPayload;

  res.status(200).json({
    ok: true,
    containerName: String(data?.containerName || containerName),
    tail: Number(data?.tail || tail),
    logs: String(data?.logs || ''),
  });
});
