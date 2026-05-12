import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import { PublishRequest, PublishRequestStatus, ModuleEntity, UIPackage, GlobalModulePackage, HttpMethod } from '@idp/shared';
import { resolveTenant } from '@/lib/tenancy';
import { generateVersion } from '@/lib/version';
import redis from '@/lib/redis';

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

  const tenant = request.tenant;
  if (tenant.isSuspended) {
    res.status(403).json({ error: 'Tenant is suspended' });
    return;
  }

  if (request.status !== PublishRequestStatus.PENDING) {
    res.status(400).json({ error: 'Only pending requests can be approved' });
    return;
  }

  // Perform actual publishing for each item
  for (const item of request.items) {
    if (item.kind === 'module') {
      const modRepo = CoreDataSource.getRepository(ModuleEntity);
      const mod = await modRepo.findOne({ where: { id: item.id, tenant: { id: tenant.id } } });
      if (mod) {
        const previousMethod = (mod.publishedMethod ?? mod.method) as HttpMethod;
        const nextMethod = item.data.method;

        mod.publishedVersion = generateVersion();
        mod.publishedRoutePath = item.data.routePath;
        mod.publishedMethod = item.data.method;
        mod.publishedCode = item.data.code;
        mod.publishedFileExtension = item.data.fileExtension;
        mod.publishedAt = new Date();
        await modRepo.save(mod);

        await redis.del(
          `module:published:${tenant.id}:${previousMethod}`,
          `module:published:${tenant.id}:${nextMethod}`,
          `module:published:${tenant.id}:${previousMethod}:is_publish_workflow`,
          `module:published:${tenant.id}:${nextMethod}:is_publish_workflow`
        );
      }
    } else if (item.kind === 'ui') {
      const uiRepo = CoreDataSource.getRepository(UIPackage);
      const pkg = await uiRepo.findOne({ where: { id: item.id, tenant: { id: tenant.id } } });
      if (pkg) {
        pkg.publishedVersion = generateVersion();
        pkg.publishedCode = item.data.code;
        pkg.publishedCodeBlob = item.data.codeBlob;
        pkg.publishedDependencies = item.data.dependencies ?? [];
        pkg.publishedFileExtension = item.data.fileExtension;
        pkg.publishedAt = new Date();
        await uiRepo.save(pkg);
      }
    } else if (item.kind === 'shared') {
      const sharedRepo = CoreDataSource.getRepository(GlobalModulePackage);
      const pkg = await sharedRepo.findOne({ where: { id: item.id } });
      if (pkg) {
        pkg.publishedVersion = generateVersion();
        pkg.publishedCode = item.data.code;
        pkg.publishedCodeBlob = item.data.codeBlob;
        pkg.publishedDependencies = item.data.dependencies ?? [];
        pkg.publishedFileExtension = item.data.fileExtension;
        pkg.publishedAt = new Date();
        await sharedRepo.save(pkg);
      }
    }
  }

  request.status = PublishRequestStatus.APPROVED;
  request.approver = { id: user.id } as any;
  request.publishedAt = new Date();
  await repo.save(request);

  res.status(200).json(request);
});
