import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import { OrchestrationOperation, Tenant } from '@idp/shared';

const norm = (value: unknown, max = 255) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
};
const asHeaderValue = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : Array.isArray(value) ? value[0] || '' : '';

const tenantForRequest = async (req: NextApiRequest) => {
  const tenantHost = norm(asHeaderValue(req.headers['x-tenant-host']) || process.env.DEV_TENANT_HOST || '', 255);
  if (!tenantHost) return null;
  return CoreDataSource.getRepository(Tenant).findOne({ where: { hostname: tenantHost } });
};

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  await requireAdmin(req);
  await ensureCoreSchema();

  const tenant = await tenantForRequest(req);
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  const workloadId = norm(req.query.workloadId, 80) || undefined;
  const limitRaw = Number(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit || 100);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

  const repo = CoreDataSource.getRepository(OrchestrationOperation);
  const operations = await repo.find({
    where: {
      tenantId: tenant.id,
      ...(workloadId ? { workloadId } : {}),
    },
    order: { createdAt: 'DESC' },
    take: limit,
  });
  res.status(200).json({ operations });
});
