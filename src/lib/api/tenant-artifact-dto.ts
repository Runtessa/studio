import type { ModuleEntity, UIPackage } from '@idp/shared';
import { getTailwindPackageName, stripTailwindDependency } from '../tailwindBuilder';

export const serializeModule = (mod: ModuleEntity) => ({
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

export const serializeUiPackage = (pkg: UIPackage) => ({
  id: pkg.id,
  name: pkg.name,
  version: pkg.version,
  code: pkg.code,
  codeBlob: pkg.codeBlob,
  dependencies: stripTailwindDependency(pkg.dependencies ?? [], getTailwindPackageName(pkg.name)),
  fileExtension: pkg.fileExtension,
  draftVersion: pkg.draftVersion,
  publishedVersion: pkg.publishedVersion ?? undefined,
  publishedCode: pkg.publishedCode ?? undefined,
  publishedCodeBlob: pkg.publishedCodeBlob ?? undefined,
  publishedDependencies: stripTailwindDependency(
    pkg.publishedDependencies ?? [],
    getTailwindPackageName(pkg.name)
  ),
  publishedFileExtension: pkg.publishedFileExtension ?? undefined,
  publishedAt: pkg.publishedAt ?? undefined,
  createdAt: pkg.createdAt,
  updatedAt: pkg.updatedAt,
});
