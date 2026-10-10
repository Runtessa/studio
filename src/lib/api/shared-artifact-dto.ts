import type { GlobalUIPackage, GlobalModulePackage } from '@idp/shared';
import { getTailwindPackageName, stripTailwindDependency } from '../tailwindBuilder';
import { canEditSharedProject, canPublishSharedProject, canManageSharedProjectAccess, getSharedProjectTeamAccess } from '../shared-project-access';

export const serializeSharedUiPackage = (pkg: GlobalUIPackage, user: Parameters<typeof canEditSharedProject>[0]) => {
  const teamAccess = getSharedProjectTeamAccess(pkg);
  return {
    id: pkg.id,
    name: pkg.name,
    version: pkg.version,
    entryPath: pkg.entryPath,
    code: pkg.code,
    codeBlob: pkg.codeBlob,
    dependencies: stripTailwindDependency(pkg.dependencies ?? [], getTailwindPackageName(pkg.name)),
    fileExtension: pkg.fileExtension,
    draftVersion: pkg.draftVersion,
    publishedVersion: pkg.publishedVersion ?? undefined,
    publishedAt: pkg.publishedAt ?? undefined,
    ownerTeamId: teamAccess.ownerTeamId ?? undefined,
    editorTeamIds: teamAccess.editorTeamIds,
    canEdit: canEditSharedProject(user, pkg),
    canPublish: canPublishSharedProject(user, pkg),
    canManageAccess: canManageSharedProjectAccess(user, pkg),
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
};

export const serializeSharedModulePackage = (pkg: GlobalModulePackage, user: Parameters<typeof canEditSharedProject>[0]) => {
  const teamAccess = getSharedProjectTeamAccess(pkg);
  return {
    id: pkg.id,
    name: pkg.name,
    version: pkg.version,
    entryPath: pkg.entryPath,
    code: pkg.code,
    codeBlob: pkg.codeBlob,
    dependencies: pkg.dependencies ?? [],
    fileExtension: pkg.fileExtension,
    draftVersion: pkg.draftVersion,
    publishedVersion: pkg.publishedVersion ?? undefined,
    publishedAt: pkg.publishedAt ?? undefined,
    ownerTeamId: teamAccess.ownerTeamId ?? undefined,
    editorTeamIds: teamAccess.editorTeamIds,
    canEdit: canEditSharedProject(user, pkg),
    canPublish: canPublishSharedProject(user, pkg),
    canManageAccess: canManageSharedProjectAccess(user, pkg),
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
};
