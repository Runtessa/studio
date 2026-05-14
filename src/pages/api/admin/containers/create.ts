import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { createContainer, hasContainerOrchestrator } from '@/lib/container-orchestrator-client';

type CreatePayload = {
  ok?: boolean;
  containerName?: string;
  created?: boolean;
  running?: boolean;
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

  const image = String(req.body?.image || '').trim();
  if (!image) {
    res.status(400).json({ ok: false, error: 'image is required' });
    return;
  }

  const payload = {
    image,
    name: String(req.body?.name || '').trim(),
    env: Array.isArray(req.body?.env) ? req.body.env : [],
    envMap:
      req.body?.envMap && typeof req.body?.envMap === 'object' && !Array.isArray(req.body?.envMap)
        ? req.body.envMap
        : {},
    binds: Array.isArray(req.body?.binds) ? req.body.binds : [],
    ports: Array.isArray(req.body?.ports) ? req.body.ports : [],
    cmd: Array.isArray(req.body?.cmd) ? req.body.cmd : [],
    entrypoint: Array.isArray(req.body?.entrypoint) ? req.body.entrypoint : [],
    restartPolicy: String(req.body?.restartPolicy || 'unless-stopped').trim(),
    autoStart: req.body?.autoStart === undefined ? true : Boolean(req.body?.autoStart),
    managed: Boolean(req.body?.managed),
    labels:
      req.body?.labels && typeof req.body?.labels === 'object' && !Array.isArray(req.body?.labels)
        ? req.body.labels
        : {},
  };

  const result = (await createContainer(payload, resolveTargetAgent(req))) as CreatePayload;

  res.status(201).json({
    ok: true,
    containerName: String(result?.containerName || ''),
    created: Boolean(result?.created),
    running: Boolean(result?.running),
  });
});
