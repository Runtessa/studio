import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { assertTenantReadableForUser } from '@/lib/team-tenant-access';
import { assertPublishRequestItems } from '@/lib/publish-request-access';
import { approveRequest } from '@/lib/publication/approve-request';
import { cleanupPublicationCache } from '@/lib/publication/cache-cleanup';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import { PublishRequest, PublishRequestStatus } from '@idp/shared';
import { ensureCoreUserIdentity } from '@/lib/core-users';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end();
    return;
  }

  const user = await requireAdmin(req);
  await ensureCoreSchema();

  const repo = CoreDataSource.getRepository(PublishRequest);
  const request = await repo.findOne({
    where: { id: req.query.id as string },
    relations: ['requester', 'tenant'],
  });

  if (!request) {
    res.status(404).json({ error: 'Publish request not found' });
    return;
  }

  await assertTenantReadableForUser(user, request.tenant.id);

  const tenant = request.tenant;
  if (tenant.isSuspended) {
    res.status(403).json({ error: 'Tenant is suspended' });
    return;
  }

  if (request.status === PublishRequestStatus.REJECTED) {
    res.status(400).json({ error: 'Only pending requests can be approved' });
    return;
  }

  await assertPublishRequestItems(user, request.items);

  const coreUser = await ensureCoreUserIdentity({
    id: user.id,
    email: user.email,
    role: user.role,
    token: user.token ?? null,
  });

  const result = await approveRequest(CoreDataSource, String(req.query.id), user, coreUser.id);
  const cacheRefreshPending = await cleanupPublicationCache(result.cacheKeys);
  res.status(200).json({ ...result.request, cacheRefreshPending });
});
