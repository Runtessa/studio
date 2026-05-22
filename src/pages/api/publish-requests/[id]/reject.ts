import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
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
  const coreUser = await ensureCoreUserIdentity({
    id: user.id,
    email: user.email,
    role: user.role,
    token: user.token ?? null,
  });

  const repo = CoreDataSource.getRepository(PublishRequest);
  const request = await repo.findOne({
    where: { id: req.query.id as string },
    relations: ['tenant'],
  });

  if (!request) {
    res.status(404).json({ error: 'Publish request not found' });
    return;
  }

  if (request.tenant.isSuspended) {
    res.status(403).json({ error: 'Tenant is suspended' });
    return;
  }

  if (request.status !== PublishRequestStatus.PENDING) {
    res.status(400).json({ error: 'Only pending requests can be rejected' });
    return;
  }

  const { note } = req.body;
  if (!note) {
    res.status(400).json({ error: 'Rejection note is required' });
    return;
  }

  request.status = PublishRequestStatus.REJECTED;
  request.approver = { id: coreUser.id } as any;
  request.rejectionNote = note;
  await repo.save(request);

  res.status(200).json(request);
});
