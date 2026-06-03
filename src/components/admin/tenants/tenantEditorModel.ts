import { buildAdapterConfigTemplate, DEFAULT_ADAPTER_CONFIG_TEMPLATE } from '@/lib/tenant-adapter-config';
import { parseAdapterConfigText } from '@/lib/tenant-config-validation';
import { serializeTenantPwaManifest } from '@/lib/tenant-pwa-manifest';
import type { TenantBrandingFormState } from './TenantBrandingForm';
import type { TenantPwaFormState } from './types';

export type TenantSummary = {
  id: string;
  hostname: string;
  canWrite?: boolean;
  isSuspended: boolean;
  allowRegistration?: boolean;
  ssoEnabled?: boolean;
  resourceConfig?: { memory: number; timeout: number };
  adapterAccess?: Record<string, { allow: string[] }>;
  adapterConfig?: Record<string, unknown>;
  authDbConfig?: { mode?: 'shared' | 'dedicated'; secretKey?: string | null };
  brandingConfig?: Partial<TenantBrandingFormState>;
  pwaConfig?: Partial<TenantPwaFormState>;
  createdAt?: string;
  updatedAt?: string;
};

export type TenantDetails = {
  tenant: TenantSummary;
  secrets?: Array<{ keyName: string; updatedAt?: string }>;
};

export type TenantEditState = {
  id: string;
  originalHostname: string;
  hostname: string;
  isSuspended: boolean;
  allowRegistration: boolean;
  ssoEnabled: boolean;
  memory: string;
  timeout: string;
  authDbMode: 'shared' | 'dedicated';
  authDbSecretKey: string;
  branding: TenantBrandingFormState;
  pwa: TenantPwaFormState;
};

export const DEFAULT_FORM: TenantEditState = {
  id: '',
  originalHostname: '',
  hostname: '',
  isSuspended: false,
  allowRegistration: true,
  ssoEnabled: false,
  memory: '512',
  timeout: '5000',
  authDbMode: 'shared',
  authDbSecretKey: '',
  branding: {
    title: '',
    faviconUrl: '',
    appleTouchIconUrl: '',
  },
  pwa: {
    enabled: false,
    name: '',
    shortName: '',
    description: '',
    themeColor: '#121212',
    backgroundColor: '#121212',
    display: 'standalone',
    startUrl: '/',
    scope: '/',
    icons: [],
  },
};

export const DEFAULT_CONFIG_TEXT = DEFAULT_ADAPTER_CONFIG_TEMPLATE;
export const EMPTY_CONFIG_TEXT = JSON.stringify({ adapters: {} }, null, 2);

export const mapTenantToFormState = (tenant: TenantSummary): TenantEditState => ({
  id: tenant.id,
  originalHostname: tenant.hostname,
  hostname: tenant.hostname,
  isSuspended: tenant.isSuspended,
  allowRegistration: tenant.allowRegistration ?? true,
  ssoEnabled: tenant.ssoEnabled ?? false,
  memory: String(tenant.resourceConfig?.memory ?? Number(DEFAULT_FORM.memory)),
  timeout: String(tenant.resourceConfig?.timeout ?? Number(DEFAULT_FORM.timeout)),
  authDbMode: tenant.authDbConfig?.mode === 'dedicated' ? 'dedicated' : 'shared',
  authDbSecretKey: tenant.authDbConfig?.secretKey ?? '',
  branding: {
    title: tenant.brandingConfig?.title ?? '',
    faviconUrl: tenant.brandingConfig?.faviconUrl ?? '',
    appleTouchIconUrl: tenant.brandingConfig?.appleTouchIconUrl ?? '',
  },
  pwa: {
    enabled: tenant.pwaConfig?.enabled === true,
    name: tenant.pwaConfig?.name ?? '',
    shortName: tenant.pwaConfig?.shortName ?? '',
    description: tenant.pwaConfig?.description ?? '',
    themeColor: tenant.pwaConfig?.themeColor ?? '#121212',
    backgroundColor: tenant.pwaConfig?.backgroundColor ?? '#121212',
    display: tenant.pwaConfig?.display ?? 'standalone',
    startUrl: tenant.pwaConfig?.startUrl ?? '/',
    scope: tenant.pwaConfig?.scope ?? '/',
    icons: tenant.pwaConfig?.icons ?? [],
  },
});

export const buildTenantPayload = (values: TenantEditState) => ({
  hostname: values.hostname.trim(),
  isSuspended: values.isSuspended,
  allowRegistration: values.allowRegistration,
  ssoEnabled: values.ssoEnabled,
  resourceConfig: {
    memory: Number(values.memory),
    timeout: Number(values.timeout),
  },
  authDbConfig: {
    mode: values.authDbMode,
    secretKey: values.authDbMode === 'dedicated' ? values.authDbSecretKey.trim() : null,
  },
  brandingConfig: {
    title: values.branding.title.trim(),
    faviconUrl: values.branding.faviconUrl.trim(),
    appleTouchIconUrl: values.branding.appleTouchIconUrl.trim(),
  },
  pwaConfig: {
    enabled: values.pwa.enabled,
    name: values.pwa.name.trim() || undefined,
    shortName: values.pwa.shortName.trim() || undefined,
    description: values.pwa.description.trim() || undefined,
    themeColor: values.pwa.themeColor.trim() || '#121212',
    backgroundColor: values.pwa.backgroundColor.trim() || '#121212',
    display: values.pwa.display,
    startUrl: values.pwa.startUrl.trim() || '/',
    scope: values.pwa.scope.trim() || '/',
    icons: values.pwa.icons,
  },
});

export const buildAdapterPayload = (configText: string) => ({
  adapterConfig: parseAdapterConfigText(configText),
});

export const buildPwaManifestText = (tenant: TenantSummary) =>
  serializeTenantPwaManifest(mapTenantToFormState(tenant).pwa);

export const buildAdapterEditorText = (
  tenant: TenantSummary,
  secrets: Array<{ keyName: string; updatedAt?: string }>
) => {
  const storedConfig = tenant.adapterConfig ?? {};
  if (storedConfig && Object.keys(storedConfig).length > 0) {
    return JSON.stringify(storedConfig, null, 2);
  }
  const template = buildAdapterConfigTemplate(
    tenant.adapterAccess ?? {},
    secrets.map((secret) => secret.keyName)
  );
  return template === EMPTY_CONFIG_TEXT ? DEFAULT_CONFIG_TEXT : template;
};
