import { NextApiRequest } from 'next';
import { ensureCoreSchema, CoreDataSource } from './core-db';
import { Tenant } from '@idp/shared';
import { assertTenantReadableForUser, type ScopedUser } from './team-tenant-access';
import { assertIdePermissions } from './tenant-permissions';
import type { IdePermission } from './rbac';

const normalizeHost = (value: string | undefined | null) => {
  if (!value) return '';
  return value.trim().toLowerCase();
};

export const resolveTenant = async (
  req: NextApiRequest,
  user: ScopedUser,
  permissions: IdePermission | readonly IdePermission[] = [],
): Promise<Tenant> => {
  assertIdePermissions(user, permissions);
  await ensureCoreSchema();

  const rawHeader = req.headers['x-tenant-host'];
  if (Array.isArray(rawHeader)) {
    const err = new Error('A single tenant header is required');
    (err as any).statusCode = 400;
    throw err;
  }
  const headerOverride = normalizeHost(rawHeader);
  const devFallback = normalizeHost(process.env.DEV_TENANT_HOST);

  let hostname = headerOverride || devFallback;

  if (!hostname) {
    const err = new Error('Tenant header required to resolve tenant');
    (err as any).statusCode = 400;
    throw err;
  }

  const tenantRepo = CoreDataSource.getRepository(Tenant);
  const tenant = await tenantRepo.findOne({ where: { hostname } });

  if (!tenant) {
    const err = new Error('Tenant not found');
    (err as any).statusCode = 404;
    throw err;
  }

  await assertTenantReadableForUser(user, tenant.id);

  if (tenant.isSuspended) {
    const err = new Error('Tenant suspended');
    (err as any).statusCode = 403;
    throw err;
  }

  if (!tenant.resourceConfig) {
    tenant.resourceConfig = { memory: 512, timeout: 5_000 };
  }

  return tenant;
};
