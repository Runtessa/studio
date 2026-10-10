import {
  GlobalModulePackage, GlobalModulePackageFile, GlobalUIPackage, GlobalUIPackageFile,
  ModuleEntity, OrmModel, UIPackage,
} from '@idp/shared';
import { CoreDataSource } from '../core-db';
import { assertIdePermissions } from '../tenant-permissions';
import { ensureSharedProjectEditable } from '../shared-project-access';
import type { AssistantChange } from './types';
import type { AssistantToolContext } from './toolContext';

function fail(message: string, statusCode = 400): never {
  const error = new Error(message);
  (error as any).statusCode = statusCode;
  throw error;
}

// Validate the entire batch before the rollback writes its first row.
export const assertRollbackAccess = async (
  changes: AssistantChange[], ctx: AssistantToolContext,
) => {
  const restored = new Set<string>();
  const removed = new Set<string>();
  for (const change of [...changes].reverse()) {
    if (!change || !['create', 'update', 'delete'].includes(change.action)) {
      fail('Invalid rollback change');
    }
    if (change.kind === 'acl') {
      if (change.action !== 'update' || !['permissions', 'roles', 'endpoints'].includes(change.file)) {
        fail('Invalid ACL rollback');
      }
      assertIdePermissions(ctx, 'ide.acl.write');
      continue;
    }
    const snapshot = change.action === 'create' ? change.after : change.before;
    if (!snapshot || typeof snapshot.id !== 'string' || !snapshot.id) {
      fail('Rollback snapshot requires an id');
    }
    if (change.kind === 'module' || change.kind === 'model' || change.kind === 'ui') {
      const entity = { module: ModuleEntity, model: OrmModel, ui: UIPackage }[change.kind];
      const permission = { module: 'ide.modules.write', model: 'ide.models.write', ui: 'ide.ui.write' } as const;
      assertIdePermissions(ctx, permission[change.kind]);
      const repo = CoreDataSource.getRepository(entity as any);
      const key = `${change.kind}:${snapshot.id}`;
      if (change.action === 'delete') {
        if (!removed.has(key) && await repo.findOne({ where: { id: snapshot.id } })) {
          fail('Rollback target already exists', 409);
        }
        restored.add(key);
        removed.delete(key);
      } else {
        if (removed.has(key) || (!restored.has(key) && !await repo.findOne({
          where: { id: snapshot.id, tenant: { id: ctx.tenant.id } },
        }))) fail('Rollback target not found in selected tenant', 404);
        if (change.action === 'create') {
          removed.add(key);
          restored.delete(key);
        }
      }
      continue;
    }
    if (change.kind !== 'shared-project' && change.kind !== 'shared-file') {
      fail('Invalid rollback kind');
    }
    const kind = change.kind === 'shared-file' ? change.projectKind : (snapshot as any).kind;
    if (kind !== 'ui' && kind !== 'module') fail('Invalid shared project kind');
    assertIdePermissions(ctx, kind === 'ui' ? 'ide.shared_ui.write' : 'ide.shared_modules.write');
    const projectId = change.kind === 'shared-file' ? change.projectId : snapshot.id;
    const projectRepo = CoreDataSource.getRepository(kind === 'ui' ? GlobalUIPackage : GlobalModulePackage);
    const project = await projectRepo.findOne({ where: { id: projectId } });
    if (!project) fail('Shared rollback project not found', 404);
    ensureSharedProjectEditable(ctx, project);
    if (change.kind === 'shared-file') {
      const fileRepo = CoreDataSource.getRepository(kind === 'ui' ? GlobalUIPackageFile : GlobalModulePackageFile);
      const where = change.action === 'delete'
        ? { id: snapshot.id }
        : { id: snapshot.id, project: { id: projectId } };
      const key = `shared-file:${kind}:${snapshot.id}`;
      const file = await fileRepo.findOne({ where });
      if (change.action === 'delete') {
        if (!removed.has(key) && file) fail('Rollback target already exists', 409);
        restored.add(key);
        removed.delete(key);
      } else {
        if (removed.has(key) || (!restored.has(key) && !file)) fail('Shared rollback file not found', 404);
        if (change.action === 'create') {
          removed.add(key);
          restored.delete(key);
        }
      }
    }
  }
};
