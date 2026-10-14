import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireUser } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import {
  PublishRequest,
  PublishRequestStatus,
  ModuleEntity,
  UIPackage,
  GlobalModulePackage,
  GlobalUIPackage,
} from '@idp/shared';
import { resolveTenant } from '@/lib/tenancy';
import { ensureCoreUserIdentity } from '@/lib/core-users';
import { assertIdePermissions } from '@/lib/tenant-permissions';
import { ensureSharedProjectEditable } from '@/lib/shared-project-access';
import { snapshotPublicationStyles } from '@/lib/publication/style-snapshot';

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end();
    return;
  }

  const user = await requireUser(req);
  const tenant = await resolveTenant(req, user);
  await ensureCoreSchema();

  const { comment, itemIds } = req.body;

  if (!comment || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0 || !itemIds.every((id: unknown) => typeof id === 'string')) {
    res.status(400).json({ error: 'comment and non-empty itemIds are required' });
    return;
  }

  const items: any[] = [];
  
  for (const itemId of itemIds) {
    if (itemId.startsWith('module-')) {
      assertIdePermissions(user, 'ide.modules.write');
      const id = itemId.replace('module-', '');
      const mod = await CoreDataSource.getRepository(ModuleEntity).findOne({
        where: { id, tenant: { id: tenant.id } },
        relations: ['sourceCode', 'publishedSourceCode'],
      });
      if (mod) {
        const publishedSourceCode = mod.publishedSourceCode as any;
        items.push({
          kind: 'module',
          id: mod.id,
          title: `${mod.method} ${mod.routePath}`,
          originalCode: mod.publishedCode ?? '',
          originalSourceCodeId: publishedSourceCode?.id ?? null,
          data: {
            code: mod.code,
            routePath: mod.routePath,
            method: mod.method,
            fileExtension: mod.fileExtension,
          }
        });
      }
    } else if (itemId.startsWith('ui-')) {
      assertIdePermissions(user, 'ide.ui.write');
      const id = itemId.replace('ui-', '');
      const pkg = await CoreDataSource.getRepository(UIPackage).findOne({
        where: { id, tenant: { id: tenant.id } },
        relations: [
          'sourceCode',
          'compiledCode',
          'publishedSourceCode',
          'publishedCompiledCode',
        ],
      });
      if (pkg) {
        const publishedSourceCode = pkg.publishedSourceCode as any;
        items.push({
          kind: 'ui',
          id: pkg.id,
          title: pkg.name,
          originalCode: pkg.publishedCode ?? '',
          originalSourceCodeId: publishedSourceCode?.id ?? null,
          originalCodeBlob: pkg.publishedCodeBlob || null,
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
      const backendPkg = await CoreDataSource.getRepository(GlobalModulePackage).findOne({
        where: { id },
        relations: [
          'sourceCode',
          'compiledCode',
          'publishedSourceCode',
          'publishedCompiledCode',
        ],
      });
      if (backendPkg) {
        assertIdePermissions(user, 'ide.shared_modules.write');
        ensureSharedProjectEditable(user, backendPkg);
        const publishedSourceCode = backendPkg.publishedSourceCode as any;
        items.push({
          kind: 'shared',
          sharedType: 'backend',
          id: backendPkg.id,
          title: backendPkg.name,
          originalCode: backendPkg.publishedCode ?? '',
          originalSourceCodeId: publishedSourceCode?.id ?? null,
          originalCodeBlob: backendPkg.publishedCodeBlob || null,
          data: {
            code: backendPkg.code,
            codeBlob: backendPkg.codeBlob,
            name: backendPkg.name,
            version: backendPkg.version,
            dependencies: backendPkg.dependencies,
            fileExtension: backendPkg.fileExtension,
            entryPath: backendPkg.entryPath,
          }
        });
        continue;
      }

      const uiPkg = await CoreDataSource.getRepository(GlobalUIPackage).findOne({
        where: { id },
        relations: [
          'sourceCode',
          'compiledCode',
          'publishedSourceCode',
          'publishedCompiledCode',
        ],
      });
      if (uiPkg) {
        assertIdePermissions(user, 'ide.shared_ui.write');
        ensureSharedProjectEditable(user, uiPkg);
        const publishedSourceCode = uiPkg.publishedSourceCode as any;
        items.push({
          kind: 'shared',
          sharedType: 'ui',
          id: uiPkg.id,
          title: uiPkg.name,
          originalCode: uiPkg.publishedCode ?? '',
          originalSourceCodeId: publishedSourceCode?.id ?? null,
          originalCodeBlob: uiPkg.publishedCodeBlob || null,
          data: {
            code: uiPkg.code,
            codeBlob: uiPkg.codeBlob,
            name: uiPkg.name,
            version: uiPkg.version,
            dependencies: uiPkg.dependencies,
            fileExtension: uiPkg.fileExtension,
            entryPath: uiPkg.entryPath,
          }
        });
      }
    }
  }

  if (items.length === 0) {
    res.status(400).json({ error: 'No valid items found to publish' });
    return;
  }

  await snapshotPublicationStyles(items, tenant.id, CoreDataSource.manager);

  const coreUser = await ensureCoreUserIdentity({
    id: user.id,
    email: user.email,
    role: user.role,
    token: user.token ?? null,
  });

  const repo = CoreDataSource.getRepository(PublishRequest);
  const request = repo.create({
    tenant: { id: tenant.id } as any,
    requester: { id: coreUser.id } as any,
    comment,
    items,
    status: PublishRequestStatus.PENDING,
  });

  await repo.save(request);

  res.status(201).json(request);
});
