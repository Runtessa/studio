import { assertRollbackAccess } from './rollback-access';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import {
  HttpMethod,
  ModuleEntity,
  Tenant,
  UIPackage,
  GlobalUIPackage,
  GlobalUIPackageFile,
  GlobalModulePackage,
  GlobalModulePackageFile,
  OrmModel,
  SourceCode,
  CompiledCode,
} from '@idp/shared';
import { generateVersion } from '@/lib/version';
import { compileOrmSource } from '@/lib/orm-compiler';
import { rebuildTailwindPackagesForTenant, clearRegistryCache } from '@/lib/ui-entity-tailwind';
import {
  normalizeAclPermissionsValue,
  normalizeAclRolesValue,
  normalizeAclEndpointsValue,
} from './aclNormalization';
import { ensureAclEndpoint } from './workspaceOps';
import { isTailwindConfigName, isTailwindPackageName, shouldBuildTailwind, getTailwindPackageName } from '@/lib/tailwindBuilder';
import { removeTailwindPackage } from '@/lib/ui-entity-tailwind';
import { buildTailwindCssFromFiles, upsertGlobalTailwindPackage } from '@/lib/shared-tailwind';
import { buildSharedBundle } from './compiler';
import type { AssistantChange } from './types';
import type { AssistantToolContext } from './toolContext';

// Duplicate D17: see docs/release/code-integrity-audit.md before changing either copy.
const cleanupTailwindPackages = async (tenantId: string) => {
  const repo = CoreDataSource.getRepository(UIPackage);
  const packages = await repo.find({ where: { tenant: { id: tenantId } } });
  const expected = new Set(
    packages
      .filter(
        (pkg) =>
          !isTailwindPackageName(pkg.name) &&
          !isTailwindConfigName(pkg.name) &&
          shouldBuildTailwind(pkg.fileExtension)
      )
      .map((pkg) => `${getTailwindPackageName(pkg.name)}::${pkg.version}`)
  );
  const tailwindPackages = packages.filter((pkg) => isTailwindPackageName(pkg.name));
  for (const pkg of tailwindPackages) {
    const key = `${pkg.name}::${pkg.version}`;
    if (expected.has(key)) continue;
    await removeTailwindPackage(tenantId, pkg.name, pkg.version);
  }
};

const updateSharedBundle = async (
  project: GlobalUIPackage | GlobalModulePackage,
  files: Array<GlobalUIPackageFile | GlobalModulePackageFile>
) => {
  const entryPath =
    project.entryPath ||
    (project.fileExtension === 'jsx' ? 'src/index.jsx' : 'src/index.js');
  const entryFile = files.find((file) => (file.path || '') === entryPath);
  const entrySource = entryFile?.content ?? '';
  const bundle = buildSharedBundle(
    { entryPath },
    files.map((file) => ({
      path: file.path ?? '',
      content: file.content ?? '',
      fileExtension: file.fileExtension ?? undefined,
    }))
  );
  const sourceRepo = CoreDataSource.getRepository(SourceCode);
  const compiledRepo = CoreDataSource.getRepository(CompiledCode);
  const sourceCode = sourceRepo.create({ code: entrySource });
  const compiledCode = compiledRepo.create({ code: bundle });
  await sourceRepo.save(sourceCode);
  await compiledRepo.save(compiledCode);
  project.sourceCode = sourceCode;
  project.compiledCode = compiledCode;
  project.draftVersion = generateVersion();
  return project;
};

// Duplicate D07: see docs/release/code-integrity-audit.md before changing either copy.
const rebuildSharedProject = async (
  projectId: string,
  projectKind: 'ui' | 'module'
) => {
  const projectRepo =
    projectKind === 'ui'
      ? CoreDataSource.getRepository(GlobalUIPackage)
      : CoreDataSource.getRepository(GlobalModulePackage);
  const fileRepo =
    projectKind === 'ui'
      ? CoreDataSource.getRepository(GlobalUIPackageFile)
      : CoreDataSource.getRepository(GlobalModulePackageFile);
  const project = await projectRepo.findOne({ where: { id: projectId } });
  if (!project) return;
  const files = await fileRepo.find({
    where: { project: { id: projectId } },
    order: { path: 'ASC' },
  });
  await updateSharedBundle(project as any, files as any);
  await projectRepo.save(project as any);
  if (
    projectKind === 'ui' &&
    shouldBuildTailwind(project.fileExtension) &&
    !isTailwindPackageName(project.name)
  ) {
    const css = await buildTailwindCssFromFiles(files as any);
    await upsertGlobalTailwindPackage(
      getTailwindPackageName(project.name),
      project.version,
      css
    );
  }
};

export const rollbackChanges = async (
  changes: AssistantChange[],
  ctx: AssistantToolContext
) => {
  await ensureCoreSchema();
  await assertRollbackAccess(changes, ctx);
  const moduleRepo = CoreDataSource.getRepository(ModuleEntity);
  const modelRepo = CoreDataSource.getRepository(OrmModel);
  const uiRepo = CoreDataSource.getRepository(UIPackage);
  const tenantRepo = CoreDataSource.getRepository(Tenant);
  const sharedUiRepo = CoreDataSource.getRepository(GlobalUIPackage);
  const sharedUiFileRepo = CoreDataSource.getRepository(GlobalUIPackageFile);
  const sharedModuleRepo = CoreDataSource.getRepository(GlobalModulePackage);
  const sharedModuleFileRepo = CoreDataSource.getRepository(GlobalModulePackageFile);
  const sourceRepo = CoreDataSource.getRepository(SourceCode);
  const compiledRepo = CoreDataSource.getRepository(CompiledCode);
  let uiTouched = false;
  const sharedTouched = new Map<string, 'ui' | 'module'>();

  for (const change of [...changes].reverse()) {
    if (change.kind === 'module') {
      if (change.action === 'create' && change.after) {
        const mod = await moduleRepo.findOne({ where: { id: change.after.id, tenant: { id: ctx.tenant.id } } });
        if (mod) await moduleRepo.remove(mod);
      } else if (change.action === 'delete' && change.before) {
        const sourceCode = sourceRepo.create({ code: change.before.code ?? '' });
        await sourceRepo.save(sourceCode);
        const mod = moduleRepo.create({
          id: change.before.id,
          routePath: change.before.routePath,
          method: change.before.method as HttpMethod,
          fileExtension: change.before.fileExtension,
          sourceCode,
          tenant: ctx.tenant,
          draftVersion: generateVersion(),
        } as any) as unknown as ModuleEntity;
        await moduleRepo.insert({
          id: mod.id, routePath: mod.routePath, method: mod.method,
          fileExtension: mod.fileExtension, draftVersion: mod.draftVersion,
          sourceCode: { id: sourceCode.id }, tenant: { id: ctx.tenant.id },
        });
        await ensureAclEndpoint(ctx.tenant, mod.routePath);
      } else if (change.action === 'update' && change.before) {
        const mod = await moduleRepo.findOne({
          where: { id: change.before.id, tenant: { id: ctx.tenant.id } },
          relations: ['sourceCode'],
        });
        if (mod) {
          const sourceCode = sourceRepo.create({ code: change.before.code ?? '' });
          await sourceRepo.save(sourceCode);
          mod.routePath = change.before.routePath;
          mod.method = change.before.method as HttpMethod;
          mod.sourceCode = sourceCode;
          mod.fileExtension = change.before.fileExtension ?? mod.fileExtension;
          mod.draftVersion = generateVersion();
          await moduleRepo.save(mod);
          await ensureAclEndpoint(ctx.tenant, mod.routePath);
        }
      }
    }

    if (change.kind === 'ui') {
      uiTouched = true;
      if (change.action === 'create' && change.after) {
        const pkg = await uiRepo.findOne({ where: { id: change.after.id, tenant: { id: ctx.tenant.id } } });
        if (pkg) await uiRepo.remove(pkg);
      } else if (change.action === 'delete' && change.before) {
        const sourceCode = sourceRepo.create({ code: change.before.code ?? '' });
        const compiledCode = compiledRepo.create({ code: change.before.codeBlob ?? '' });
        await sourceRepo.save(sourceCode);
        await compiledRepo.save(compiledCode);
        const pkg = uiRepo.create({
          id: change.before.id,
          name: change.before.name,
          version: change.before.version,
          dependencies: change.before.dependencies,
          fileExtension: change.before.fileExtension,
          sourceCode,
          compiledCode,
          tenant: ctx.tenant,
          draftVersion: generateVersion(),
        } as any) as unknown as UIPackage;
        await uiRepo.insert({
          id: pkg.id, name: pkg.name, version: pkg.version,
          dependencies: pkg.dependencies, fileExtension: pkg.fileExtension,
          draftVersion: pkg.draftVersion, tenant: { id: ctx.tenant.id },
          sourceCode: { id: sourceCode.id }, compiledCode: { id: compiledCode.id },
        });
        await clearRegistryCache(ctx.tenant.id, pkg.name, pkg.version);
      } else if (change.action === 'update' && change.before) {
        const pkg = await uiRepo.findOne({
          where: { id: change.before.id, tenant: { id: ctx.tenant.id } },
          relations: ['sourceCode', 'compiledCode'],
        });
        if (pkg) {
          const sourceCode = sourceRepo.create({ code: change.before.code ?? '' });
          const compiledCode = compiledRepo.create({ code: change.before.codeBlob ?? '' });
          await sourceRepo.save(sourceCode);
          await compiledRepo.save(compiledCode);
          pkg.name = change.before.name;
          pkg.version = change.before.version;
          pkg.sourceCode = sourceCode;
          pkg.compiledCode = compiledCode;
          pkg.dependencies = change.before.dependencies;
          pkg.fileExtension = change.before.fileExtension ?? pkg.fileExtension;
          pkg.draftVersion = generateVersion();
          await uiRepo.save(pkg);
          await clearRegistryCache(ctx.tenant.id, pkg.name, pkg.version);
        }
      }
    }

    if (change.kind === 'model') {
      if (change.action === 'create' && change.after) {
        const model = await modelRepo.findOne({ where: { id: change.after.id, tenant: { id: ctx.tenant.id } } });
        if (model) await modelRepo.remove(model);
      } else if (change.action === 'delete' && change.before) {
        const code = change.before.code ?? '';
        const fileExtension = change.before.fileExtension ?? 'js';
        const sourceCode = sourceRepo.create({ code });
        const compiledCode = compiledRepo.create({
          code: compileOrmSource(code, fileExtension),
        });
        await sourceRepo.save(sourceCode);
        await compiledRepo.save(compiledCode);
        const restored = modelRepo.create({
          id: change.before.id,
          path: change.before.path,
          fileExtension,
          tenant: ctx.tenant,
          sourceCode,
          compiledCode,
          draftVersion: generateVersion(),
        } as any) as unknown as OrmModel;
        await modelRepo.insert({
          id: restored.id, path: restored.path, fileExtension: restored.fileExtension,
          draftVersion: restored.draftVersion, tenant: { id: ctx.tenant.id },
          sourceCode: { id: sourceCode.id }, compiledCode: { id: compiledCode.id },
        });
      } else if (change.action === 'update' && change.before) {
        const model = await modelRepo.findOne({
          where: { id: change.before.id, tenant: { id: ctx.tenant.id } },
          relations: ['sourceCode', 'compiledCode'],
        });
        if (model) {
          const code = change.before.code ?? '';
          const fileExtension = change.before.fileExtension ?? 'js';
          const sourceCode = sourceRepo.create({ code });
          const compiledCode = compiledRepo.create({
            code: compileOrmSource(code, fileExtension),
          });
          await sourceRepo.save(sourceCode);
          await compiledRepo.save(compiledCode);
          model.path = change.before.path;
          model.sourceCode = sourceCode;
          model.compiledCode = compiledCode;
          model.fileExtension = fileExtension;
          model.draftVersion = generateVersion();
          await modelRepo.save(model);
        }
      }
    }

    if (change.kind === 'acl') {
      const tenant = await tenantRepo.findOne({ where: { id: ctx.tenant.id } });
      if (!tenant) continue;
      if (change.file === 'permissions') {
        tenant.aclPermissions = normalizeAclPermissionsValue(change.before);
      } else if (change.file === 'roles') {
        tenant.aclRoles = normalizeAclRolesValue(change.before);
      } else {
        tenant.aclEndpoints = normalizeAclEndpointsValue(change.before);
      }
      await tenantRepo.save(tenant);
    }

    if (change.kind === 'shared-file') {
      sharedTouched.set(change.projectId, change.projectKind);
      const fileRepo =
        change.projectKind === 'ui' ? sharedUiFileRepo : sharedModuleFileRepo;
      const projectRepo =
        change.projectKind === 'ui' ? sharedUiRepo : sharedModuleRepo;
      if (change.action === 'create' && change.after) {
        const file = await fileRepo.findOne({ where: { id: change.after.id, project: { id: change.projectId } } });
        if (file) await fileRepo.remove(file);
      } else if (change.action === 'delete' && change.before) {
        const project = await projectRepo.findOne({
          where: { id: change.projectId },
        });
        if (!project) continue;
        const file = fileRepo.create({
          id: change.before.id,
          path: change.before.path,
          content: change.before.content,
          fileExtension: change.before.fileExtension,
          project: project as any,
        } as any);
        await fileRepo.insert(file);
      } else if (change.action === 'update' && change.before) {
        const file = await fileRepo.findOne({ where: { id: change.before.id, project: { id: change.projectId } } });
        if (file) {
          file.path = change.before.path;
          file.content = change.before.content;
          file.fileExtension = change.before.fileExtension ?? file.fileExtension;
          await fileRepo.save(file);
        }
      }
    }

    if (change.kind === 'shared-project') {
      const kind =
        change.after?.kind ?? change.before?.kind ?? 'ui';
      const projectRepo = kind === 'ui' ? sharedUiRepo : sharedModuleRepo;
      if (change.action === 'create' && change.after) {
        const project = await projectRepo.findOne({
          where: { id: change.after.id },
        });
        if (project) {
          await projectRepo.remove(project as any);
        }
      } else if (change.action === 'update' && change.before) {
        const project = await projectRepo.findOne({
          where: { id: change.before.id },
          relations: ['sourceCode', 'compiledCode'],
        });
        if (project) {
          const sourceCode = sourceRepo.create({ code: change.before.code ?? '' });
          const compiledCode = compiledRepo.create({ code: change.before.codeBlob ?? '' });
          await sourceRepo.save(sourceCode);
          await compiledRepo.save(compiledCode);
          (project as any).name = change.before.name;
          (project as any).version = change.before.version;
          (project as any).entryPath = change.before.entryPath;
          (project as any).sourceCode = sourceCode;
          (project as any).compiledCode = compiledCode;
          (project as any).dependencies = change.before.dependencies;
          (project as any).fileExtension =
            change.before.fileExtension ?? (project as any).fileExtension;
          (project as any).draftVersion = generateVersion();
          await projectRepo.save(project as any);
        }
      }
    }
  }
  if (uiTouched) {
    await rebuildTailwindPackagesForTenant(ctx.tenant.id);
    await cleanupTailwindPackages(ctx.tenant.id);
  }
  for (const [projectId, projectKind] of sharedTouched.entries()) {
    await rebuildSharedProject(projectId, projectKind);
  }
  return { ok: true };
};
