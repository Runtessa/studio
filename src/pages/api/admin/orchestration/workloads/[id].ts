import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import { OrchestrationOperation, OrchestrationWorkload, Tenant } from '@idp/shared';

const norm = (value: unknown, max = 255) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
};
const asHeaderValue = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : Array.isArray(value) ? value[0] || '' : '';

const asReplicas = (value: unknown, fallback: number) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(10000, Math.floor(num)));
};

const runtimeTypeOf = (value: unknown, fallback: 'docker' | 'k8s') =>
  String(value || '').trim().toLowerCase() === 'k8s' ? 'k8s' : fallback;

const stateOf = (value: unknown, fallback: 'running' | 'stopped' | 'removed') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'stopped') return 'stopped';
  if (normalized === 'removed') return 'removed';
  if (normalized === 'running') return 'running';
  return fallback;
};

const tenantForRequest = async (req: NextApiRequest) => {
  const tenantHost = norm(asHeaderValue(req.headers['x-tenant-host']) || process.env.DEV_TENANT_HOST || '', 255);
  if (!tenantHost) return null;
  return CoreDataSource.getRepository(Tenant).findOne({ where: { hostname: tenantHost } });
};

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
    res.status(405).end();
    return;
  }

  const user = await requireAdmin(req);
  await ensureCoreSchema();
  const tenant = await tenantForRequest(req);
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  const workloadId = norm(req.query.id, 80);
  if (!workloadId) {
    res.status(400).json({ error: 'Workload id is required' });
    return;
  }

  const workloadRepo = CoreDataSource.getRepository(OrchestrationWorkload);
  const operationRepo = CoreDataSource.getRepository(OrchestrationOperation);
  const workload = await workloadRepo.findOne({ where: { id: workloadId, tenantId: tenant.id } });
  if (!workload) {
    res.status(404).json({ error: 'Workload not found' });
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ workload });
    return;
  }

  if (req.method === 'DELETE') {
    workload.state = 'removed';
    workload.desiredReplicas = 0;
    workload.revision += 1;
    await workloadRepo.save(workload);
    await operationRepo.save(
      operationRepo.create({
        tenant,
        tenantId: tenant.id,
        workloadId: workload.id,
        type: 'remove',
        status: 'pending',
        requestedBy: user.email,
      })
    );
    res.status(204).end();
    return;
  }

  const previous = { desiredReplicas: workload.desiredReplicas, state: workload.state };
  workload.name = req.body?.name ? norm(req.body.name, 200) : workload.name;
  workload.image = req.body?.image ? norm(req.body.image, 255) : workload.image;
  workload.runtimeType = req.body?.runtimeType
    ? runtimeTypeOf(req.body.runtimeType, workload.runtimeType)
    : workload.runtimeType;
  workload.desiredReplicas =
    req.body?.desiredReplicas !== undefined
      ? asReplicas(req.body.desiredReplicas, workload.desiredReplicas)
      : workload.desiredReplicas;
  workload.state =
    req.body?.state !== undefined ? stateOf(req.body.state, workload.state) : workload.state;
  workload.revision += 1;
  workload.config =
    req.body?.config !== undefined &&
    req.body?.config &&
    typeof req.body.config === 'object' &&
    !Array.isArray(req.body.config)
      ? req.body.config
      : workload.config;

  const saved = await workloadRepo.save(workload);
  const operationType =
    saved.state === 'removed'
      ? 'remove'
      : saved.state === 'stopped'
      ? 'stop'
      : saved.desiredReplicas !== previous.desiredReplicas
      ? 'scale'
      : 'update';
  await operationRepo.save(
    operationRepo.create({
      tenant,
      tenantId: tenant.id,
      workloadId: saved.id,
      type: operationType,
      status: 'pending',
      requestedBy: user.email,
      request: { previous, next: { desiredReplicas: saved.desiredReplicas, state: saved.state } },
    })
  );
  res.status(200).json({ workload: saved });
});
