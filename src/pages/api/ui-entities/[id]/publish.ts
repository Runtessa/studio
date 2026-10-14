import { serializeUiPackage as serialize } from '@/lib/api/tenant-artifact-dto';
import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { CoreDataSource } from '@/lib/core-db';
import { UIPackage } from '@idp/shared';
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
  const tenant = await resolveTenant(req, user, 'ide.ui.publish');
  const repo = CoreDataSource.getRepository(UIPackage);
  const pkg = await repo.findOne({
    where: { id: req.query.id as string, tenant: { id: tenant.id } },
    relations: ['sourceCode', 'compiledCode', 'publishedSourceCode', 'publishedCompiledCode'],
  });
  if (!pkg) {
    res.status(404).json({ error: 'UI entity not found' });
    return;
  }

  const result = await publishCurrent(CoreDataSource, { kind: 'ui', id: pkg.id }, tenant.id, user);
  await cleanupPublicationCache(result.cacheKeys);

  res.status(200).json(serialize(result.record as UIPackage));
});
