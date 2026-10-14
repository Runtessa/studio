import { GlobalModulePackage, GlobalUIPackage } from '@idp/shared';
import { CoreDataSource } from './core-db';
import { assertIdePermissions } from './tenant-permissions';
import { ensureSharedProjectPublishable } from './shared-project-access';
import type { ScopedUser } from './team-tenant-access';
import type { EntityManager } from 'typeorm';

export const assertPublishRequestItems = async (
  user: ScopedUser,
  items: readonly { kind: string; id: string; sharedType?: string }[],
  manager?: EntityManager,
) => {
  for (const item of items) {
    if (item.kind === 'module') assertIdePermissions(user, 'ide.modules.write');
    else if (item.kind === 'ui') assertIdePermissions(user, 'ide.ui.publish');
    else if (item.kind === 'shared') {
      const isUi = item.sharedType === 'ui';
      assertIdePermissions(user, isUi ? 'ide.shared_ui.write' : 'ide.shared_modules.write');
      const repo = (manager ?? CoreDataSource).getRepository(isUi ? GlobalUIPackage : GlobalModulePackage);
      const project = await repo.findOne({ where: { id: item.id } });
      if (project) ensureSharedProjectPublishable(user, project);
    } else {
      const error = new Error('Invalid publish request item');
      (error as any).statusCode = 400;
      throw error;
    }
  }
};
