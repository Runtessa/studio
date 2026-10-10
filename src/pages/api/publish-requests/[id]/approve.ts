import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { assertTenantReadableForUser } from '@/lib/team-tenant-access';
import { assertPublishRequestItems } from '@/lib/publish-request-access';
import { claimSharedProjectOwnershipIfNeeded, ensureSharedProjectPublishable } from '@/lib/shared-project-access';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import {
  PublishRequest,
  PublishRequestStatus,
  ModuleEntity,
  UIPackage,
  GlobalModulePackage,
  GlobalUIPackage,
  HttpMethod,
  SourceCode,
} from '@idp/shared';
import { generateVersion } from '@/lib/version';
import redis from '@/lib/redis';
import { ensureCoreUserIdentity } from '@/lib/core-users';
import {
  getTailwindPackageName,
  isTailwindPackageName,
} from '@/lib/tailwindBuilder';
import { publishTailwindPackage } from '@/lib/ui-entity-tailwind';
import { publishGlobalTailwindPackage } from '@/lib/shared-tailwind';

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

  if (request.status !== PublishRequestStatus.PENDING) {
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

  // Perform actual publishing for each item
  for (const item of request.items) {
    const sourceRepo = CoreDataSource.getRepository(SourceCode);
    if (item.kind === 'module') {
      const modRepo = CoreDataSource.getRepository(ModuleEntity);
      const mod = await modRepo.findOne({ where: { id: item.id, tenant: { id: tenant.id } } });
      if (mod) {
        const previousMethod = (mod.publishedMethod ?? mod.method) as HttpMethod;
        const nextMethod = item.data.method;
        const publishedSource = sourceRepo.create({ code: item.data.code ?? '' });
        await sourceRepo.save(publishedSource);

        mod.publishedVersion = generateVersion();
        mod.publishedRoutePath = item.data.routePath;
        mod.publishedMethod = item.data.method;
        mod.publishedSourceCode = publishedSource;
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
        const publishedSource = sourceRepo.create({ code: item.data.code ?? '' });
        await sourceRepo.save(publishedSource);

        pkg.publishedVersion = generateVersion();
        pkg.publishedSourceCode = publishedSource;
        pkg.publishedCodeBlob = item.data.codeBlob;
        pkg.publishedDependencies = item.data.dependencies ?? [];
        pkg.publishedFileExtension = item.data.fileExtension;
        pkg.publishedAt = new Date();
        await uiRepo.save(pkg);

        if (!isTailwindPackageName(pkg.name)) {
          await publishTailwindPackage(tenant.id, getTailwindPackageName(pkg.name), pkg.version);
        }
        const encoded = encodeURIComponent(pkg.name);
        await redis.del(
          `registry:tenant:${tenant.id}:${encoded}:latest`,
          `registry:tenant:${tenant.id}:${encoded}:${pkg.version}`
        );
      }
    } else if (item.kind === 'shared') {
      const sharedType = (item as any).sharedType === 'ui' ? 'ui' : 'backend';
      if (sharedType === 'backend') {
        const sharedRepo = CoreDataSource.getRepository(GlobalModulePackage);
        const pkg = await sharedRepo.findOne({ where: { id: item.id } });
        if (pkg) {
          const access = ensureSharedProjectPublishable(user, pkg);
          claimSharedProjectOwnershipIfNeeded(pkg, access);
          const publishedSource = sourceRepo.create({ code: item.data.code ?? '' });
          await sourceRepo.save(publishedSource);

          pkg.publishedVersion = generateVersion();
          pkg.publishedSourceCode = publishedSource;
          pkg.publishedCodeBlob = item.data.codeBlob;
          pkg.publishedDependencies = item.data.dependencies ?? [];
          pkg.publishedFileExtension = item.data.fileExtension;
          pkg.publishedAt = new Date();
          await sharedRepo.save(pkg);

          const encoded = encodeURIComponent(pkg.name);
          await redis.del(
            `registry:global:${encoded}:latest`,
            `registry:global:${encoded}:${pkg.version}`
          );
        }
      } else {
        const sharedUiRepo = CoreDataSource.getRepository(GlobalUIPackage);
        const pkg = await sharedUiRepo.findOne({ where: { id: item.id } });
        if (pkg) {
          const access = ensureSharedProjectPublishable(user, pkg);
          claimSharedProjectOwnershipIfNeeded(pkg, access);
          const publishedSource = sourceRepo.create({ code: item.data.code ?? '' });
          await sourceRepo.save(publishedSource);

          pkg.publishedVersion = generateVersion();
          pkg.publishedSourceCode = publishedSource;
          pkg.publishedCodeBlob = item.data.codeBlob;
          pkg.publishedDependencies = item.data.dependencies ?? [];
          pkg.publishedFileExtension = item.data.fileExtension;
          pkg.publishedAt = new Date();
          await sharedUiRepo.save(pkg);

          if (!isTailwindPackageName(pkg.name)) {
            await publishGlobalTailwindPackage(
              getTailwindPackageName(pkg.name),
              pkg.version
            );
          }
          const encoded = encodeURIComponent(pkg.name);
          await redis.del(
            `registry:global:${encoded}:latest`,
            `registry:global:${encoded}:${pkg.version}`
          );
        }
      }
    }
  }

  request.status = PublishRequestStatus.APPROVED;
  request.approver = { id: coreUser.id } as any;
  request.publishedAt = new Date();
  await repo.save(request);

  res.status(200).json(request);
});
