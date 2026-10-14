import { serializeSharedUiPackage as serialize } from '@/lib/api/shared-artifact-dto';
import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import { GlobalUIPackage } from '@idp/shared';
import { ensureSharedProjectPublishable } from '@/lib/shared-project-access';

import { publishCurrent } from '@/lib/publication/publish-current';
import { cleanupPublicationCache } from '@/lib/publication/cache-cleanup';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end();
    return;
  }

  const user = await requireAdmin(req);
  await ensureCoreSchema();

  const repo = CoreDataSource.getRepository(GlobalUIPackage);
  const pkg = await repo.findOne({
    where: { id: req.query.id as string },
    relations: ['sourceCode', 'compiledCode', 'publishedSourceCode', 'publishedCompiledCode'],
  });
  if (!pkg) {
    res.status(404).json({ error: 'Shared package not found' });
    return;
  }
  ensureSharedProjectPublishable(user, pkg);

  const result = await publishCurrent(CoreDataSource, { kind: 'shared', sharedType: 'ui', id: pkg.id }, '', user);
  await cleanupPublicationCache(result.cacheKeys);

  res.status(200).json({ package: serialize(result.record as GlobalUIPackage, user) });
});
