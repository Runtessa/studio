import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import { PublishRequest, PublishRequestStatus, ModuleEntity, UIPackage, GlobalModulePackage } from '@idp/shared';
import { resolveTenant } from '@/lib/tenancy';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end();
    return;
  }

  const user = await requireUser(req);
  const tenant = await resolveTenant(req);
  await ensureCoreSchema();

  const { comment, itemIds } = req.body;

  if (!comment || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    res.status(400).json({ error: 'comment and non-empty itemIds are required' });
    return;
  }

  const items: any[] = [];
  
  for (const itemId of itemIds) {
    if (itemId.startsWith('module-')) {
      const id = itemId.replace('module-', '');
      const mod = await CoreDataSource.getRepository(ModuleEntity).findOne({
        where: { id, tenant: { id: tenant.id } }
      });
      if (mod) {
        items.push({
          kind: 'module',
          id: mod.id,
          title: `${mod.method} ${mod.routePath}`,
          originalCode: mod.publishedCode || null,
          data: {
            code: mod.code,
            routePath: mod.routePath,
            method: mod.method,
            fileExtension: mod.fileExtension,
          }
        });
      }
    } else if (itemId.startsWith('ui-')) {
      const id = itemId.replace('ui-', '');
      const pkg = await CoreDataSource.getRepository(UIPackage).findOne({
        where: { id, tenant: { id: tenant.id } }
      });
      if (pkg) {
        items.push({
          kind: 'ui',
          id: pkg.id,
          title: pkg.name,
          originalCode: pkg.publishedCode || null,
          data: {
            code: pkg.code,
            codeBlob: pkg.codeBlob,
            name: pkg.name,
            version: pkg.version,
            dependencies: pkg.dependencies,
            fileExtension: pkg.fileExtension,
          }
        });
      }
    } else if (itemId.startsWith('shared-project-')) {
      const id = itemId.replace('shared-project-', '');
      const pkg = await CoreDataSource.getRepository(GlobalModulePackage).findOne({
        where: { id }
      });
      if (pkg) {
        // Shared projects are a bit different, but let's snapshot for now
        items.push({
          kind: 'shared',
          id: pkg.id,
          title: pkg.name,
          originalCode: pkg.publishedCode || null,
          data: {
            code: pkg.code,
            codeBlob: pkg.codeBlob,
            name: pkg.name,
            version: pkg.version,
            dependencies: pkg.dependencies,
            fileExtension: pkg.fileExtension,
            entryPath: pkg.entryPath,
          }
        });
      }
    }
  }

  if (items.length === 0) {
    res.status(400).json({ error: 'No valid items found to publish' });
    return;
  }

  const repo = CoreDataSource.getRepository(PublishRequest);
  const request = repo.create({
    tenant: { id: tenant.id } as any,
    requester: { id: user.id } as any,
    comment,
    items,
    status: PublishRequestStatus.PENDING,
  });

  await repo.save(request);

  res.status(201).json(request);
});
