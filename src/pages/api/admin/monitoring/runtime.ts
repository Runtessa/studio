import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import {
  applyServiceAction,
  getServiceState,
  hasContainerOrchestrator,
} from '@/lib/container-orchestrator-client';

const allowedActions = new Set(['create', 'start', 'stop', 'restart', 'remove']);

const firstString = (value: string | string[] | undefined) =>
  Array.isArray(value) ? String(value[0] || '') : String(value || '');

const resolveTargetAgent = (req: NextApiRequest) => {
  const fromQuery = firstString(req.query.agentId).trim();
  const fromBody = String(req.body?.agentId || '').trim();
  return (
    fromQuery ||
    fromBody ||
    String(process.env.AGENT_CONTAINER_MANAGER_TARGET || '').trim() ||
    undefined
  );
};

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
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

  const targetAgent = resolveTargetAgent(req);

  if (req.method === 'GET') {
    const data = await getServiceState({ service: 'monitoring' }, targetAgent);
    res.status(200).json({ ok: true, ...(data as object) });
    return;
  }

  const action = String(req.body?.action || '').trim().toLowerCase();
  if (!allowedActions.has(action)) {
    res.status(400).json({
      ok: false,
      error: 'Invalid action. Use create/start/stop/restart/remove.',
    });
    return;
  }

  const data = await applyServiceAction({ service: 'monitoring', action }, targetAgent);
  res.status(200).json({ ok: true, action, ...(data as object) });
});
