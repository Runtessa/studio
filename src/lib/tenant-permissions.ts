import type { IdePermission } from './rbac';
import type { ScopedUser } from './team-tenant-access';

export const assertIdePermissions = (
  user: ScopedUser,
  required: IdePermission | readonly IdePermission[],
) => {
  if (!user) {
    const error = new Error('Unauthorized');
    (error as any).statusCode = 401;
    throw error;
  }
  if (user.isAdmin) return;
  for (const permission of typeof required === 'string' ? [required] : required) {
    if (user.permissions?.includes(permission)) continue;
    const error = new Error(`Forbidden: missing permission ${permission}`);
    (error as any).statusCode = 403;
    throw error;
  }
};
