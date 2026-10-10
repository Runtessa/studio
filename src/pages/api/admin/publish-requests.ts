import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import { PublishRequest } from '@idp/shared';
import { resolveTenant } from '@/lib/tenancy';
import { assertTenantReadableForUser } from '@/lib/team-tenant-access';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  const user = await requireAdmin(req);
  await ensureCoreSchema();

  const tenantId = req.query.tenantId as string;
  let where: any = {};

  if (tenantId) {
    await assertTenantReadableForUser(user, tenantId);
    where.tenant = { id: tenantId };
  } else {
    // If no tenantId is provided, try to resolve from header
    try {
      const tenant = await resolveTenant(req, user);
      where.tenant = { id: tenant.id };
    } catch (e: any) {
      if (e?.statusCode !== 400) throw e;
      // If we can't resolve tenant, only return all if platform admin
      if (user.role !== 'platform_admin' && user.normalizedRole !== 'platform_admin') {
        res.status(200).json([]);
        return;
      }
      // For platform admin, where remains {} which returns all
    }
  }

  const repo = CoreDataSource.getRepository(PublishRequest);
  
  const pageValue = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
  const limitValue = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const pageNum = Number(pageValue ?? 1);
  const limitNum = Number(limitValue ?? 20);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.floor(pageNum) : 1;
  const limit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(100, Math.floor(limitNum)) : 20;
  const skip = (page - 1) * limit;

  const [requests, total] = await repo.findAndCount({
    where,
    relations: ['requester', 'approver', 'tenant'],
    order: { createdAt: 'DESC' },
    skip,
    take: limit,
  });

  res.status(200).json({
    requests,
    page,
    limit,
    total,
  });
});
