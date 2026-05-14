import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { applyServiceAction, hasContainerOrchestrator } from '@/lib/container-orchestrator-client';

const allowedActions = new Set(['create', 'start', 'stop', 'restart', 'remove']);

type ServiceActionState = {
  service?: string;
  userKey?: string;
  containerName?: string;
  engine?: string;
  image?: string;
  exists?: boolean;
  running?: boolean;
  port?: number | null;
  host?: string;
  baseUrl?: string;
};

type ServiceActionPayload = {
  ok?: boolean;
  state?: ServiceActionState;
};

type ServiceActionInput = {
  service: string;
  action: string;
  userId?: string;
  userName?: string;
  preferredPort?: number;
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

  const service = String(req.body?.service || '').trim();
  const action = String(req.body?.action || '')
    .trim()
    .toLowerCase();

  if (!service) {
    res.status(400).json({ ok: false, error: 'service is required' });
    return;
  }
  if (!allowedActions.has(action)) {
    res.status(400).json({
      ok: false,
      error: 'Invalid action. Use create/start/stop/restart/remove.',
    });
    return;
  }

  const payload: ServiceActionInput = { service, action };
  if (req.body?.userId !== undefined && req.body?.userId !== null && req.body?.userId !== '') {
    payload.userId = String(req.body.userId);
  }
  if (
    req.body?.userName !== undefined &&
    req.body?.userName !== null &&
    String(req.body.userName).trim() !== ''
  ) {
    payload.userName = String(req.body.userName);
  }
  if (req.body?.preferredPort !== undefined && req.body?.preferredPort !== null) {
    const port = Number(req.body.preferredPort);
    if (Number.isFinite(port) && port > 0 && port < 65536) {
      payload.preferredPort = Math.floor(port);
    }
  }

  const result = (await applyServiceAction(
    payload,
    resolveTargetAgent(req)
  )) as ServiceActionPayload;

  res.status(200).json({
    ok: true,
    service,
    action,
    state: result?.state || null,
  });
});
