import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import {
  applyContainerAction,
  hasContainerOrchestrator,
} from '@/lib/container-orchestrator-client';

const allowedActions = new Set(['start', 'stop', 'restart', 'remove']);

type ContainerActionPayload = {
  ok?: boolean;
  containerName?: string;
  action?: string;
  exists?: boolean;
  running?: boolean;
  removed?: boolean;
  existed?: boolean;
};

const resolveTargetAgent = (req: NextApiRequest) => {
  const fromBody = String(req.body?.agentId || '').trim();
  return fromBody || String(process.env.AGENT_CONTAINER_MANAGER_TARGET || '').trim() || undefined;
};

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
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

  const containerName = String(req.body?.containerName || '').trim();
  const action = String(req.body?.action || '')
    .trim()
    .toLowerCase();

  if (!containerName) {
    res.status(400).json({ ok: false, error: 'containerName is required' });
    return;
  }
  if (!allowedActions.has(action)) {
    res.status(400).json({
      ok: false,
      error: 'Invalid action. Use start/stop/restart/remove.',
    });
    return;
  }

  const result = (await applyContainerAction(
    { containerName, action },
    resolveTargetAgent(req)
  )) as ContainerActionPayload;

  res.status(200).json({
    ok: true,
    action,
    containerName,
    result,
  });
});
