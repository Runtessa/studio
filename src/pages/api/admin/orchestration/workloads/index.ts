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

const asReplicas = (value: unknown, fallback = 1) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(10000, Math.floor(num)));
};

const runtimeTypeOf = (value: unknown) => (String(value || '').trim().toLowerCase() === 'k8s' ? 'k8s' : 'docker');

const stateOf = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'stopped') return 'stopped';
  if (normalized === 'removed') return 'removed';
  return 'running';
};

const tenantForRequest = async (req: NextApiRequest) => {
  const tenantHost = norm(asHeaderValue(req.headers['x-tenant-host']) || process.env.DEV_TENANT_HOST || '', 255);
  if (!tenantHost) return null;
  return CoreDataSource.getRepository(Tenant).findOne({ where: { hostname: tenantHost } });
};

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
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

  const workloadRepo = CoreDataSource.getRepository(OrchestrationWorkload);
  const operationRepo = CoreDataSource.getRepository(OrchestrationOperation);

  if (req.method === 'GET') {
    const workloads = await workloadRepo.find({
      where: { tenantId: tenant.id },
      order: { updatedAt: 'DESC' },
    });
    res.status(200).json({ workloads });
    return;
  }

  const key = norm(req.body?.key, 160);
  const name = norm(req.body?.name, 200);
  const image = norm(req.body?.image, 255);
  if (!key || !name || !image) {
    res.status(400).json({ error: 'key, name, and image are required' });
    return;
  }
  const existing = await workloadRepo.findOne({ where: { tenantId: tenant.id, key } });
  if (existing) {
    res.status(409).json({ error: 'Workload key already exists' });
    return;
  }

  const workload = workloadRepo.create({
    tenant,
    tenantId: tenant.id,
    key,
    name,
    image,
    runtimeType: runtimeTypeOf(req.body?.runtimeType),
    desiredReplicas: asReplicas(req.body?.desiredReplicas, 1),
    state: stateOf(req.body?.state),
    revision: 1,
    config:
      req.body?.config && typeof req.body.config === 'object' && !Array.isArray(req.body.config)
        ? req.body.config
        : null,
    placement:
      req.body?.placement &&
      typeof req.body.placement === 'object' &&
      !Array.isArray(req.body.placement)
        ? req.body.placement
        : null,
    metadata:
      req.body?.metadata &&
      typeof req.body.metadata === 'object' &&
      !Array.isArray(req.body.metadata)
        ? req.body.metadata
        : null,
  });
  const saved = await workloadRepo.save(workload);
  await operationRepo.save(
    operationRepo.create({
      tenant,
      tenantId: tenant.id,
      workloadId: saved.id,
      type: 'create',
      status: 'pending',
      requestedBy: user.email,
      request: { desiredReplicas: saved.desiredReplicas, state: saved.state },
    })
  );

  res.status(201).json({ workload: saved });
});
