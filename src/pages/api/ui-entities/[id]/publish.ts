import { serializeUiPackage as serialize } from '@/lib/api/tenant-artifact-dto';
import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { CoreDataSource } from '@/lib/core-db';
import { SourceCode, UIPackage } from '@idp/shared';
import { resolveTenant } from '@/lib/tenancy';
import redis from '@/lib/redis';
import { generateVersion } from '@/lib/version';
import { getTailwindPackageName, isTailwindPackageName } from '@/lib/tailwindBuilder';
import { publishTailwindPackage } from '@/lib/ui-entity-tailwind';

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

  const sourceRepo = CoreDataSource.getRepository(SourceCode);
  const publishedSource = sourceRepo.create({ code: pkg.code });
  await sourceRepo.save(publishedSource);

  pkg.publishedVersion = generateVersion();
  pkg.publishedSourceCode = publishedSource;
  pkg.publishedCodeBlob = pkg.codeBlob;
  pkg.publishedDependencies = pkg.dependencies ?? [];
  pkg.publishedFileExtension = pkg.fileExtension;
  pkg.publishedAt = new Date();
  await repo.save(pkg);

  if (!isTailwindPackageName(pkg.name)) {
    await publishTailwindPackage(tenant.id, getTailwindPackageName(pkg.name), pkg.version);
  }

  const encoded = encodeURIComponent(pkg.name);
  await redis.del(
    `registry:tenant:${tenant.id}:${encoded}:latest`,
    `registry:tenant:${tenant.id}:${encoded}:${pkg.version}`
  );

  res.status(200).json(serialize(pkg));
});
