import { CoreDataSource } from '@/lib/core-db';
import { UIPackage } from '@idp/shared';
import { SourceCode, CompiledCode } from '@idp/shared';
import redis from '@/lib/redis';
import { generateVersion } from '@/lib/version';
import { ILike, In } from 'typeorm';
import {
  buildTailwindCss,
  getTailwindPackageName,
  isTailwindConfigName,
  isTailwindPackageName,
  parseTailwindConfig,
  shouldBuildTailwind,
} from '@/lib/tailwindBuilder';

export const registryCacheKey = (tenantId: string, name: string, version: string) =>
  `registry:tenant:${tenantId}:${encodeURIComponent(name)}:${version}`;

export const clearRegistryCache = async (tenantId: string, name: string, version: string) => {
  await redis.del(
    registryCacheKey(tenantId, name, 'latest'),
    registryCacheKey(tenantId, name, version)
  );
};

export const upsertTailwindPackage = async (
  tenantId: string,
  name: string,
  version: string,
  css: string
) => {
  const repo = CoreDataSource.getRepository(UIPackage);
  const sourceRepo = CoreDataSource.getRepository(SourceCode);
  const compiledRepo = CoreDataSource.getRepository(CompiledCode);
  let pkg = await repo.findOne({
    where: { tenant: { id: tenantId }, name, version },
    relations: ['sourceCode', 'compiledCode'],
  });
  const sourceCode = sourceRepo.create({ code: css });
  const compiledCode = compiledRepo.create({ code: css });
  await sourceRepo.save(sourceCode);
  await compiledRepo.save(compiledCode);
  if (!pkg) {
    pkg = repo.create({
      tenant: { id: tenantId } as UIPackage['tenant'],
      name,
      version,
      sourceCode,
      compiledCode,
      dependencies: [],
      fileExtension: 'css',
      draftVersion: generateVersion(),
    });
  } else {
    pkg.sourceCode = sourceCode;
    pkg.compiledCode = compiledCode;
    pkg.dependencies = [];
    pkg.fileExtension = 'css';
    pkg.draftVersion = generateVersion();
  }
  await repo.save(pkg);
  await clearRegistryCache(tenantId, name, version);
  return pkg;
};

export const removeTailwindPackage = async (
  tenantId: string,
  name: string,
  version: string
) => {
  const repo = CoreDataSource.getRepository(UIPackage);
  const pkg = await repo.findOne({
    where: { tenant: { id: tenantId }, name, version },
  });
  if (!pkg) return;
  await clearRegistryCache(tenantId, name, version);
  await repo.remove(pkg);
};

export const publishTailwindPackage = async (
  tenantId: string,
  name: string,
  version: string
) => {
  const repo = CoreDataSource.getRepository(UIPackage);
  const pkg = await repo.findOne({
    where: { tenant: { id: tenantId }, name, version },
    relations: ['sourceCode', 'compiledCode'],
  });
  if (!pkg) return null;

  pkg.publishedVersion = generateVersion();
  pkg.publishedSourceCode = pkg.sourceCode;
  pkg.publishedCompiledCode = pkg.compiledCode;
  pkg.publishedDependencies = [];
  pkg.publishedFileExtension = pkg.fileExtension;
  pkg.publishedAt = new Date();
  await repo.save(pkg);
  await clearRegistryCache(tenantId, name, version);
  return pkg;
};

export const loadTailwindConfigForTenant = async (tenantId: string) => {
  const repo = CoreDataSource.getRepository(UIPackage);
  const candidates = await repo.find({
    where: [
      {
        tenant: { id: tenantId },
        name: In([
          'tailwind.config',
          'tailwind.config.js',
          'tailwind.config.cjs',
          'tailwind.config.mjs',
          'tailwind.config.json',
        ]),
      },
      {
        tenant: { id: tenantId },
        name: ILike('%tailwind.config%'),
      },
    ],
    relations: ['sourceCode', 'compiledCode'],
    order: { updatedAt: 'DESC' },
    take: 5,
  });
  const configPkg = candidates.find((pkg) => isTailwindConfigName(pkg.name));
  if (!configPkg) return null;
  const source = configPkg.sourceCode?.code ?? configPkg.compiledCode?.code ?? '';
  return parseTailwindConfig(source);
};

export const rebuildTailwindPackagesForTenant = async (tenantId: string) => {
  const repo = CoreDataSource.getRepository(UIPackage);
  const packages = await repo.find({
    where: { tenant: { id: tenantId } },
    relations: ['sourceCode', 'compiledCode'],
  });
  const config = await loadTailwindConfigForTenant(tenantId);
  const buildTargets = packages.filter(
    (pkg) =>
      !isTailwindPackageName(pkg.name) &&
      !isTailwindConfigName(pkg.name) &&
      shouldBuildTailwind(pkg.fileExtension)
  );
  for (const pkg of buildTargets) {
    const source = pkg.sourceCode?.code ?? pkg.compiledCode?.code ?? '';
    const css = await buildTailwindCss(source, pkg.fileExtension, config ?? undefined);
    await upsertTailwindPackage(
      tenantId,
      getTailwindPackageName(pkg.name),
      pkg.version,
      css
    );
  }
};
