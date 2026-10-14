import { serializeModule as serialize } from '@/lib/api/tenant-artifact-dto';
import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { CoreDataSource } from '@/lib/core-db';
import { ModuleEntity } from '@idp/shared';
import { resolveTenant } from '@/lib/tenancy';

import { publishCurrent } from '@/lib/publication/publish-current';
import { cleanupPublicationCache } from '@/lib/publication/cache-cleanup';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end();
    return;
  }

  const user = await requireUser(req);
  const tenant = await resolveTenant(req, user, 'ide.modules.write');
  const repo = CoreDataSource.getRepository(ModuleEntity);
  const mod = await repo.findOne({
    where: { id: req.query.id as string, tenant: { id: tenant.id } },
    relations: ['sourceCode', 'publishedSourceCode'],
  });
  if (!mod) {
    res.status(404).json({ error: 'Module not found' });
    return;
  }

  const result = await publishCurrent(CoreDataSource, { kind: 'module', id: mod.id }, tenant.id, user);
  await cleanupPublicationCache(result.cacheKeys);

  res.status(200).json(serialize(result.record as ModuleEntity));
});
