import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { CoreDataSource, ensureCoreSchema } from '@/lib/core-db';
import { Tenant } from '@idp/shared';
import { Secret } from '@idp/shared';
import { In } from 'typeorm';
import { encryptSecret } from '@/lib/crypto';
import { canonicalizeAdapterConfig, parseAdapterConfig } from '@/lib/tenant-adapter-config';
import { canWriteTenantForUser, getTenantScopeForUser } from '@/lib/team-tenant-access';
import { seedTenantStarterProject } from '@/lib/tenantStarterProject';
import { DEFAULT_PWA_CONFIG, normalizePwaConfig } from '@/lib/tenant-pwa-config';
import { normalizeBoundedInteger, normalizeTenantHostname } from '@/lib/tenant-config-validation';

const DEFAULT_RESOURCE_CONFIG = { memory: 512, timeout: 5000 };
const DEFAULT_AUTH_DB_CONFIG = { mode: 'shared' as const, secretKey: null as string | null };
const DEFAULT_BRANDING_CONFIG = { title: '', faviconUrl: '', appleTouchIconUrl: '' };

const normalizeHostname = (raw: unknown) => normalizeTenantHostname(raw);

const normalizeNumber = (raw: unknown, label: string, fallback: number) =>
  normalizeBoundedInteger(raw, label, fallback, label.includes('memory') ? 64 : 100, label.includes('memory') ? 262144 : 300000);

const normalizeResourceConfig = (
  raw: unknown,
  fallback: { memory: number; timeout: number }
) => {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'object') {
    const err = new Error('resourceConfig must be an object');
    (err as any).statusCode = 400;
    throw err;
  }
  const values = raw as { memory?: unknown; timeout?: unknown };
  return {
    memory: normalizeNumber(values.memory, 'resourceConfig.memory', fallback.memory),
    timeout: normalizeNumber(values.timeout, 'resourceConfig.timeout', fallback.timeout),
  };
};

const normalizeBoolean = (raw: unknown, fallback: boolean) => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true' || raw === 'false') return raw === 'true';
  const err = new Error('isSuspended must be a boolean');
  (err as any).statusCode = 400;
  throw err;
};

const normalizeAuthDbConfig = (
  raw: unknown,
  fallback: { mode: 'shared' | 'dedicated'; secretKey?: string | null }
) => {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'object') {
    const err = new Error('authDbConfig must be an object');
    (err as any).statusCode = 400;
    throw err;
  }
  const values = raw as { mode?: unknown; secretKey?: unknown };
  const modeRaw = values.mode ?? fallback.mode;
  if (modeRaw !== 'shared' && modeRaw !== 'dedicated') {
    const err = new Error("authDbConfig.mode must be 'shared' or 'dedicated'");
    (err as any).statusCode = 400;
    throw err;
  }
  const secretKey =
    typeof values.secretKey === 'string' && values.secretKey.trim()
      ? values.secretKey.trim()
      : null;
  if (modeRaw === 'dedicated' && !secretKey) {
    const err = new Error('authDbConfig.secretKey is required when mode is dedicated');
    (err as any).statusCode = 400;
    throw err;
  }
  return {
    mode: modeRaw,
    secretKey: modeRaw === 'shared' ? null : secretKey,
  } as { mode: 'shared' | 'dedicated'; secretKey?: string | null };
};

const normalizeBrandingConfig = (
  raw: unknown,
  fallback: { title?: string; faviconUrl?: string; appleTouchIconUrl?: string } = DEFAULT_BRANDING_CONFIG
) => {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    const err = new Error('brandingConfig must be an object');
    (err as any).statusCode = 400;
    throw err;
  }
  const values = raw as Record<string, unknown>;
  return {
    title: typeof values.title === 'string' ? values.title.trim() : fallback.title || '',
    faviconUrl:
      typeof values.faviconUrl === 'string' ? values.faviconUrl.trim() : fallback.faviconUrl || '',
    appleTouchIconUrl:
      typeof values.appleTouchIconUrl === 'string'
        ? values.appleTouchIconUrl.trim()
        : fallback.appleTouchIconUrl || '',
  };
};

const readLegacyBrandingConfig = (rawAdapterConfig: unknown) => {
  const adapterConfig = (rawAdapterConfig && typeof rawAdapterConfig === 'object' && !Array.isArray(rawAdapterConfig))
    ? (rawAdapterConfig as Record<string, unknown>)
    : {};
  const settings =
    adapterConfig.settings &&
    typeof adapterConfig.settings === 'object' &&
    !Array.isArray(adapterConfig.settings)
      ? (adapterConfig.settings as Record<string, unknown>)
      : {};
  const settingsBranding =
    settings.branding &&
    typeof settings.branding === 'object' &&
    !Array.isArray(settings.branding)
      ? (settings.branding as Record<string, unknown>)
      : {};
  const rootBranding =
    adapterConfig.branding &&
    typeof adapterConfig.branding === 'object' &&
    !Array.isArray(adapterConfig.branding)
      ? (adapterConfig.branding as Record<string, unknown>)
      : {};

  return {
    title:
      typeof rootBranding.title === 'string'
        ? rootBranding.title
        : typeof settingsBranding.title === 'string'
          ? settingsBranding.title
          : '',
    faviconUrl:
      typeof rootBranding.faviconUrl === 'string'
        ? rootBranding.faviconUrl
        : typeof settingsBranding.faviconUrl === 'string'
          ? settingsBranding.faviconUrl
          : '',
    appleTouchIconUrl:
      typeof rootBranding.appleTouchIconUrl === 'string'
        ? rootBranding.appleTouchIconUrl
        : typeof settingsBranding.appleTouchIconUrl === 'string'
          ? settingsBranding.appleTouchIconUrl
          : '',
  };
};

const parseAdapterConfigObject = (raw: unknown): Record<string, unknown> | null => {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        const err = new Error('adapterConfig must be an object');
        (err as any).statusCode = 400;
        throw err;
      }
      return parsed as Record<string, unknown>;
    } catch {
      const err = new Error('adapterConfig must be valid JSON');
      (err as any).statusCode = 400;
      throw err;
    }
  }
  if (typeof raw !== 'object') {
    const err = new Error('adapterConfig must be an object');
    (err as any).statusCode = 400;
    throw err;
  }
  return raw as Record<string, unknown>;
};

const serializeTenant = (tenant: Tenant, canWrite: boolean) => ({
  id: tenant.id,
  hostname: tenant.hostname,
  isSuspended: tenant.isSuspended,
  allowRegistration: tenant.allowRegistration ?? true,
  resourceConfig: tenant.resourceConfig,
  adapterAccess: tenant.adapterAccess ?? {},
  adapterConfig: canonicalizeAdapterConfig(tenant.adapterConfig ?? {}),
  authDbConfig: tenant.authDbConfig ?? DEFAULT_AUTH_DB_CONFIG,
  pwaConfig: normalizePwaConfig(tenant.pwaConfig, DEFAULT_PWA_CONFIG),
  brandingConfig: normalizeBrandingConfig(
    (tenant as any).brandingConfig,
    readLegacyBrandingConfig(tenant.adapterConfig ?? {})
  ),
  canWrite,
  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt,
});

const parsePagination = (rawPage: unknown, rawLimit: unknown) => {
  const pageValue = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const limitValue = Array.isArray(rawLimit) ? rawLimit[0] : rawLimit;
  const pageNum = Number(pageValue ?? 1);
  const limitNum = Number(limitValue ?? 20);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.floor(pageNum) : 1;
  const limit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(100, Math.floor(limitNum)) : 20;
  return { page, limit, skip: (page - 1) * limit };
};

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'GET') {
    const user = await requireAdmin(req);
    await ensureCoreSchema();

    const repo = CoreDataSource.getRepository(Tenant);
    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);
    const scopedTenantIds = await getTenantScopeForUser(user);
    if (Array.isArray(scopedTenantIds) && scopedTenantIds.length === 0) {
      res.status(200).json({
        tenants: [],
        page,
        limit,
        total: 0,
        canCreate: user.isAdmin,
      });
      return;
    }
    const where = Array.isArray(scopedTenantIds) ? { id: In(scopedTenantIds) } : {};
    const [tenants, total] = await repo.findAndCount({
      where,
      order: { hostname: 'ASC' },
      skip,
      take: limit,
    });
    const canWrite = canWriteTenantForUser(user);

    res.status(200).json({
      tenants: tenants.map((tenant) => serializeTenant(tenant, canWrite)),
      page,
      limit,
      total,
      canCreate: user.isAdmin,
    });
    return;
  }

  if (req.method === 'POST') {
    const user = await requireAdmin(req);
    if (!user.isAdmin) {
      const err = new Error('Forbidden: tenant creation is restricted to platform admins');
      (err as any).statusCode = 403;
      throw err;
    }
    await ensureCoreSchema();

    const hostname = normalizeHostname(req.body?.hostname);
    const isSuspended = normalizeBoolean(req.body?.isSuspended, false);
    const allowRegistration = normalizeBoolean(req.body?.allowRegistration, true);
    const resourceConfig = normalizeResourceConfig(req.body?.resourceConfig, DEFAULT_RESOURCE_CONFIG);
    const authDbConfig = normalizeAuthDbConfig(req.body?.authDbConfig, DEFAULT_AUTH_DB_CONFIG);
    const pwaConfig = normalizePwaConfig(req.body?.pwaConfig, DEFAULT_PWA_CONFIG, { strict: true });
    const brandingConfig = normalizeBrandingConfig(req.body?.brandingConfig, DEFAULT_BRANDING_CONFIG);
    const configObject = parseAdapterConfigObject(req.body?.adapterConfig);
    const adapterConfig = parseAdapterConfig(configObject);
    const normalizedAdapterConfig = canonicalizeAdapterConfig(configObject);
    const adapterAccess = adapterConfig.adapterAccess;

    const repo = CoreDataSource.getRepository(Tenant);
    const existing = await repo.findOne({ where: { hostname } });
    if (existing) {
      res.status(409).json({ error: 'Tenant with this hostname already exists' });
      return;
    }

    const tenant = await CoreDataSource.transaction(async (manager) => {
      const tenantRepo = manager.getRepository(Tenant);
      const secretRepo = manager.getRepository(Secret);
      const createdTenant = tenantRepo.create({
        hostname,
        isSuspended,
        allowRegistration,
        resourceConfig,
        authDbConfig,
        pwaConfig,
        brandingConfig: brandingConfig as any,
        adapterAccess,
        adapterConfig: normalizedAdapterConfig,
      });
      await tenantRepo.save(createdTenant);

      if (adapterConfig.secrets) {
        for (const [keyName, value] of Object.entries(adapterConfig.secrets)) {
          const encrypted = encryptSecret(value);
          const secret = secretRepo.create({
            tenant: createdTenant,
            keyName,
            encryptedValue: encrypted.encryptedValue,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
          });
          await secretRepo.save(secret);
        }
      }

      await seedTenantStarterProject(manager, createdTenant);
      return createdTenant;
    });

    res.status(201).json({ tenant: serializeTenant(tenant, true) });
    return;
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end();
});
