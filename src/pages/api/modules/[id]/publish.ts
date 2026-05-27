import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { CoreDataSource } from '@/lib/core-db';
import { HttpMethod, ModuleEntity, SourceCode } from '@idp/shared';
import { resolveTenant } from '@/lib/tenancy';
import redis from '@/lib/redis';
import { generateVersion } from '@/lib/version';

const serialize = (mod: ModuleEntity) => ({
  id: mod.id,
  routePath: mod.routePath,
  method: mod.method,
  code: mod.code,
  fileExtension: mod.fileExtension,
  draftVersion: mod.draftVersion,
  publishedVersion: mod.publishedVersion ?? undefined,
  publishedRoutePath: mod.publishedRoutePath ?? undefined,
  publishedMethod: mod.publishedMethod ?? undefined,
  publishedCode: mod.publishedCode ?? undefined,
  publishedFileExtension: mod.publishedFileExtension ?? undefined,
  publishedAt: mod.publishedAt ?? undefined,
  createdAt: mod.createdAt,
  updatedAt: mod.updatedAt,
});

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end();
    return;
  }

  await requireUser(req);
  const tenant = await resolveTenant(req);
  const repo = CoreDataSource.getRepository(ModuleEntity);
  const mod = await repo.findOne({
    where: { id: req.query.id as string, tenant: { id: tenant.id } },
    relations: ['sourceCode', 'publishedSourceCode'],
  });
  if (!mod) {
    res.status(404).json({ error: 'Module not found' });
    return;
  }

  const previousMethod = (mod.publishedMethod ?? mod.method) as HttpMethod;
  const nextMethod = mod.method;
  const sourceRepo = CoreDataSource.getRepository(SourceCode);
  const publishedSource = sourceRepo.create({ code: mod.code });
  await sourceRepo.save(publishedSource);

  mod.publishedVersion = generateVersion();
  mod.publishedRoutePath = mod.routePath;
  mod.publishedMethod = mod.method;
  mod.publishedSourceCode = publishedSource;
  mod.publishedFileExtension = mod.fileExtension;
  mod.publishedAt = new Date();
  await repo.save(mod);

  await redis.del(
    `module:published:${tenant.id}:${previousMethod}`,
    `module:published:${tenant.id}:${nextMethod}`,
    `module:published:${tenant.id}:${previousMethod}:is_publish_workflow`,
    `module:published:${tenant.id}:${nextMethod}:is_publish_workflow`
  );

  res.status(200).json(serialize(mod));
});
