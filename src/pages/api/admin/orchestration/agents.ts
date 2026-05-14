import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import { OrchestrationAgent, Tenant } from '@idp/shared';

const asHeaderValue = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : Array.isArray(value) ? value[0] || '' : '';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  await requireAdmin(req);
  await ensureCoreSchema();

  const tenantHost = String(
    asHeaderValue(req.headers['x-tenant-host']) || process.env.DEV_TENANT_HOST || ''
  ).trim();
  if (!tenantHost) {
    res.status(400).json({ error: 'Missing tenant host context' });
    return;
  }

  const tenant = await CoreDataSource.getRepository(Tenant).findOne({ where: { hostname: tenantHost } });
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  const repo = CoreDataSource.getRepository(OrchestrationAgent);
  const agents = await repo.find({
    where: { tenantId: tenant.id },
    order: { heartbeatAt: 'DESC', updatedAt: 'DESC' },
  });
  res.status(200).json({ agents });
});
