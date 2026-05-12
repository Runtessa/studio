import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import { PublishRequest, ModuleEntity, UIPackage, GlobalModulePackage } from '@idp/shared';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  await requireAdmin(req);
  await ensureCoreSchema();

  const { id } = req.query;

  const repo = CoreDataSource.getRepository(PublishRequest);
  const request = await repo.findOne({
    where: { id: id as string },
    relations: ['requester', 'approver', 'tenant'],
  });

  if (!request) {
    res.status(404).json({ error: 'Publish request not found' });
    return;
  }

  res.status(200).json(request);
});
