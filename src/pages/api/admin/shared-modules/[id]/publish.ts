import { serializeSharedModulePackage as serialize } from '@/lib/api/shared-artifact-dto';
import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import { GlobalModulePackage, SourceCode } from '@idp/shared';
import { generateVersion } from '@/lib/version';
import { claimSharedProjectOwnershipIfNeeded, ensureSharedProjectPublishable } from '@/lib/shared-project-access';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end();
    return;
  }

  const user = await requireAdmin(req);
  await ensureCoreSchema();

  const repo = CoreDataSource.getRepository(GlobalModulePackage);
  const pkg = await repo.findOne({
    where: { id: req.query.id as string },
    relations: ['sourceCode', 'compiledCode', 'publishedSourceCode', 'publishedCompiledCode'],
  });
  if (!pkg) {
    res.status(404).json({ error: 'Shared backend project not found' });
    return;
  }
  const access = ensureSharedProjectPublishable(user, pkg);
  const claimed = claimSharedProjectOwnershipIfNeeded(pkg, access);
  if (claimed) {
    await repo.save(pkg);
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

  res.status(200).json({ package: serialize(pkg, user) });
});
