import { FormEvent, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataCard } from '@/components/ui/DataCard';
import { FormLayout } from '@/components/ui/FormLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { FiCheck, FiX, FiInfo, FiClock, FiUser, FiMessageSquare } from 'react-icons/fi';
import { useApi } from '@/lib/api';
import { fetchJson } from '@/lib/client/api';
import { useSessionToken } from '@/lib/client/session';
import { hasPermissionFromUser } from '@/lib/client/access';
import { getSelectedTenantHost, setSelectedTenantHost } from '@/lib/client/tenant';
import { buildAdapterConfigTemplate, DEFAULT_ADAPTER_CONFIG_TEMPLATE } from '@/lib/tenant-adapter-config';
import { TenantBrandingForm, type TenantBrandingFormState } from '@/components/admin/tenants/TenantBrandingForm';
import { TenantPwaManifestEditor } from '@/components/admin/tenants/TenantPwaManifestEditor';
import { TenantSettingsTabs } from '@/components/admin/tenants/TenantSettingsTabs';
import { TenantPwaFields } from '@/components/admin/tenants/TenantPwaFields';
import type { TenantPwaFormState } from '@/components/admin/tenants/types';
import { parseTenantPwaManifest, serializeTenantPwaManifest } from '@/lib/tenant-pwa-manifest';
import {
  emptyTenantConfigErrors,
  hasTenantCoreConfigErrors,
  parseAdapterConfigText,
  validateAdapterConfigForm,
  validateTenantCoreConfigForm,
  type TenantConfigFormErrors,
} from '@/lib/tenant-config-validation';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

type TenantSummary = {
  id: string;
  hostname: string;
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

type TenantDetails = {
  tenant: TenantSummary;
  secrets?: Array<{ keyName: string; updatedAt?: string }>;
};

type TenantEditState = {
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

const DEFAULT_FORM: TenantEditState = {
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

const DEFAULT_CONFIG_TEXT = DEFAULT_ADAPTER_CONFIG_TEMPLATE;

const EMPTY_CONFIG_TEXT = JSON.stringify({ adapters: {} }, null, 2);

export default function AdminTenantEditPage() {
  const router = useRouter();
  const { token, setToken, ready } = useSessionToken();
  const { success, error: showError } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<TenantEditState>(DEFAULT_FORM);
  const [adapterConfigText, setAdapterConfigText] = useState(DEFAULT_CONFIG_TEXT);
  const [activeTab, setActiveTab] = useState<'tenant' | 'branding' | 'pwa' | 'adapters'>('tenant');
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [pwaEditorExpanded, setPwaEditorExpanded] = useState(false);
  const [pwaManifestText, setPwaManifestText] = useState(() => serializeTenantPwaManifest(DEFAULT_FORM.pwa));
  const [pwaManifestError, setPwaManifestError] = useState('');
  const [tenantSecrets, setTenantSecrets] = useState<Array<{ keyName: string; updatedAt?: string }>>(
    []
  );
  const [validationErrors, setValidationErrors] = useState<TenantConfigFormErrors>(() =>
    emptyTenantConfigErrors()
  );

  const tenantIdRaw = router.query.id;
  const tenantId = Array.isArray(tenantIdRaw) ? tenantIdRaw[0] : tenantIdRaw;

  useEffect(() => {
    const bootstrap = async () => {
      if (!ready || !token || !tenantId) return;
      try {
        const meRes = await fetch('/api/me', {
          headers: { Authorization: `Session ${token}` },
        });
        const meData = await meRes.json();
        if (!meRes.ok) throw new Error(meData.error || 'Failed to load user');
        const role = meData?.user?.role;
        setIsAdmin(hasPermissionFromUser(meData.user, 'ide.tenants.manage'));
        if (!hasPermissionFromUser(meData.user, 'ide.tenants.manage')) {
          router.replace('/dashboard');
          return;
        }
        const detail = (await fetchJson(`/api/admin/tenants/${tenantId}`, { token })) as TenantDetails;
        const tenant = detail?.tenant;
        if (!tenant) {
          setError('Tenant not found');
          return;
        }
        setForm({
          id: tenant.id,
          originalHostname: tenant.hostname,
          hostname: tenant.hostname,
          isSuspended: tenant.isSuspended,
          allowRegistration: tenant.allowRegistration ?? true,
          ssoEnabled: tenant.ssoEnabled ?? false,
          memory: String(tenant.resourceConfig?.memory ?? Number(DEFAULT_FORM.memory)),
          timeout: String(tenant.resourceConfig?.timeout ?? Number(DEFAULT_FORM.timeout)),
          authDbMode:
            tenant.authDbConfig?.mode === 'dedicated'
              ? 'dedicated'
              : 'shared',
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
        setPwaManifestText(
          serializeTenantPwaManifest({
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
          })
        );
        const access = tenant.adapterAccess ?? {};
        const storedConfig = tenant.adapterConfig ?? {};
        const secrets = detail?.secrets ?? [];
        setTenantSecrets(secrets);
        if (storedConfig && Object.keys(storedConfig).length > 0) {
          setAdapterConfigText(JSON.stringify(storedConfig, null, 2));
        } else {
          const template = buildAdapterConfigTemplate(
            access ?? {},
            secrets.map((secret) => secret.keyName)
          );
          setAdapterConfigText(template === EMPTY_CONFIG_TEXT ? DEFAULT_CONFIG_TEXT : template);
        }
      } catch (err: any) {
        setError(err.message);
        if (err.message?.toLowerCase().includes('unauthorized')) {
          setToken('');
        }
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [ready, token, tenantId, router, setToken]);

  const buildTenantPayload = (values: TenantEditState) => ({
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

  const buildAdapterPayload = (configText: string) => ({
    adapterConfig: parseAdapterConfigText(configText),
  });

  const handlePwaFormChange = (pwa: TenantPwaFormState) => {
    setForm((current) => ({ ...current, pwa }));
    setPwaManifestText(serializeTenantPwaManifest(pwa));
    setPwaManifestError('');
  };

  const handlePwaManifestChange = (value: string) => {
    setPwaManifestText(value);
    try {
      const nextPwa = parseTenantPwaManifest(value, form.pwa);
      setForm((current) => ({ ...current, pwa: nextPwa }));
      setPwaManifestError('');
    } catch (error: any) {
      setPwaManifestError(error.message || 'Manifest JSON is invalid');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const errors = validateTenantCoreConfigForm(form);
    setValidationErrors((current) => ({ ...errors, adapterConfig: current.adapterConfig }));
    if (hasTenantCoreConfigErrors(errors) || !form.id) return;
    if (!token) return;

    try {
      const payload = buildTenantPayload(form);
      const data = await fetchJson(`/api/admin/tenants/${form.id}`, {
        method: 'PUT',
        token,
        body: payload,
      });
      const nextHostname = data?.tenant?.hostname || payload.hostname;
      success(`Updated tenant ${nextHostname}`);
      const selectedTenant = getSelectedTenantHost();
      if (selectedTenant && form.originalHostname === selectedTenant) {
        if (nextHostname && nextHostname !== selectedTenant) {
          setSelectedTenantHost(nextHostname);
        }
      }
      router.push('/admin/tenants');
    } catch (err: any) {
      showError(err.message || 'Failed to update tenant');
    }
  };

  const handleAdapterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const errors = validateAdapterConfigForm(adapterConfigText);
    setValidationErrors((current) => ({ ...current, adapterConfig: errors.adapterConfig }));
    if (errors.adapterConfig || !form.id) return;
    if (!token) return;

    try {
      await fetchJson(`/api/admin/tenants/${form.id}`, {
        method: 'PUT',
        token,
        body: buildAdapterPayload(adapterConfigText),
      });
      success('Updated adapter configuration');
    } catch (err: any) {
      showError(err.message || 'Failed to update adapter configuration');
    }
  };

  if (ready && !token) {
    return (
      <div className="min-h-screen bg-bgApp px-4 py-10 text-left text-textPrimary">
        <div className="mx-auto w-full max-w-md space-y-3 rounded-xl border border-borderSubtle bg-bgSurface p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Please log in</h2>
          <p className="text-sm text-textMuted">
            Your session expired or is missing. <a href="/login" className="text-accent">Go to login</a>.
          </p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit tenant" subtitle="You do not have access to tenant management." />
        <DataCard title="Permission Denied" subtitle="Please contact an administrator." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit tenant"
        subtitle={form.hostname ? `Update ${form.hostname}` : 'Update tenant settings.'}
        actions={
          <div className="flex gap-2">
            {tenantId ? (
              <Button variant="secondary" size="sm" href={`/admin/tenants/${tenantId}/secrets`}>
                Manage secrets
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" href="/admin/tenants">
              Back to tenants
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <TenantSettingsTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'tenant' ? (
        <DataCard title="Tenant configuration" subtitle="Update core tenant settings.">
          {loading ? (
            <div className="text-sm text-textMuted">Loading tenant data…</div>
          ) : (
            <FormLayout
              onSubmit={handleSubmit}
              actions={
                <>
                  <Button variant="secondary" href="/admin/tenants">
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    Save changes
                  </Button>
                </>
              }
              gridClassName="grid gap-5 md:grid-cols-2"
            >
              <div className="md:col-span-2">
                <Input
                  label="Hostname"
                  placeholder="tenant.example.com"
                  value={form.hostname}
                  onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                  error={validationErrors.hostname}
                />
              </div>
              <label className="flex items-center gap-2 pt-6 text-sm text-textPrimary">
                <input
                  type="checkbox"
                  checked={form.isSuspended}
                  onChange={(e) => setForm({ ...form, isSuspended: e.target.checked })}
                  className="h-4 w-4 rounded border-borderSubtle text-accent focus:ring-accent/30"
                />
                Suspended
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm text-textPrimary">
                <input
                  type="checkbox"
                  checked={form.allowRegistration}
                  onChange={(e) => setForm({ ...form, allowRegistration: e.target.checked })}
                  className="h-4 w-4 rounded border-borderSubtle text-accent focus:ring-accent/30"
                />
                Allow registration
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm text-textPrimary">
                <input
                  type="checkbox"
                  checked={form.ssoEnabled}
                  onChange={(e) => setForm({ ...form, ssoEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-borderSubtle text-accent focus:ring-accent/30"
                />
                Enable SSO
              </label>
              <Input
                label="Memory (MB)"
                type="number"
                min="1"
                step="64"
                value={form.memory}
                onChange={(e) => setForm({ ...form, memory: e.target.value })}
                error={validationErrors.memory}
              />
              <Input
                label="Timeout (ms)"
                type="number"
                min="1"
                step="100"
                value={form.timeout}
                onChange={(e) => setForm({ ...form, timeout: e.target.value })}
                error={validationErrors.timeout}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-textPrimary">Auth DB mode</label>
                <select
                  value={form.authDbMode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      authDbMode: e.target.value === 'dedicated' ? 'dedicated' : 'shared',
                    })
                  }
                  className="w-full rounded-md border border-borderSubtle bg-bgSurface px-3 py-2 text-sm text-textPrimary focus:border-accent focus:outline-none"
                >
                  <option value="shared">Shared (use global USER_DB_*)</option>
                  <option value="dedicated">Dedicated (use tenant secret key)</option>
                </select>
              </div>
              <Input
                label="Auth DB secret key"
                placeholder="userdb:tenant-a"
                value={form.authDbSecretKey}
                onChange={(e) => setForm({ ...form, authDbSecretKey: e.target.value })}
                error={validationErrors.authDbSecretKey}
                disabled={form.authDbMode !== 'dedicated'}
              />
            </FormLayout>
          )}
        </DataCard>
      ) : activeTab === 'branding' ? (
        <DataCard title="Branding" subtitle="Update the tenant title and browser icons separately from adapter config.">
          {loading ? (
            <div className="text-sm text-textMuted">Loading branding…</div>
          ) : (
            <FormLayout
              onSubmit={handleSubmit}
              actions={
                <>
                  <Button variant="secondary" href="/admin/tenants">
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    Save changes
                  </Button>
                </>
              }
            >
              <TenantBrandingForm
                value={form.branding}
                onChange={(branding) => setForm({ ...form, branding })}
              />
            </FormLayout>
          )}
        </DataCard>
      ) : activeTab === 'pwa' ? (
        <DataCard title="PWA" subtitle="Update installable app behavior for this tenant.">
          {loading ? (
            <div className="text-sm text-textMuted">Loading PWA settings…</div>
          ) : (
            <FormLayout
              onSubmit={handleSubmit}
              actions={
                <>
                  <Button variant="secondary" href="/admin/tenants">
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    Save changes
                  </Button>
                </>
              }
            >
              <TenantPwaFields
                value={form.pwa}
                errors={validationErrors.pwa}
                onChange={handlePwaFormChange}
              />
              <TenantPwaManifestEditor
                value={pwaManifestText}
                error={pwaManifestError}
                expanded={pwaEditorExpanded}
                onToggleExpanded={() => setPwaEditorExpanded((current) => !current)}
                onChange={handlePwaManifestChange}
              />
            </FormLayout>
          )}
        </DataCard>
      ) : (
        <DataCard title="Adapter configuration" subtitle="Manage tenant adapter types, options, and secret references.">
          {loading ? (
            <div className="text-sm text-textMuted">Loading adapter config…</div>
          ) : (
            <FormLayout
              onSubmit={handleAdapterSubmit}
              actions={
                <Button type="submit" variant="primary">
                  Save adapter configuration
                </Button>
              }
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-textPrimary">Adapter config JSON</label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => setEditorExpanded((current) => !current)}
                  >
                    {editorExpanded ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
                <div
                  className={`overflow-hidden rounded-md border border-borderSubtle bg-bgSurface ${
                    editorExpanded ? 'h-[70vh]' : 'h-56'
                  }`}
                >
                  <MonacoEditor
                    height="100%"
                    language="json"
                    theme="vs-dark"
                    value={adapterConfigText}
                    onChange={(nextValue) => setAdapterConfigText(nextValue ?? '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                    }}
                  />
                </div>
                {validationErrors.adapterConfig ? (
                  <p className="text-xs text-danger">{validationErrors.adapterConfig}</p>
                ) : null}
                <p className="text-xs text-textMuted">
                  Existing secrets: {tenantSecrets.length ? tenantSecrets.map((secret) => secret.keyName).join(', ') : 'none'}.
                  Use secret refs such as `adapter:redis:cache:default` and manage actual secret values in the tenant secrets page.
                </p>
              </div>
            </FormLayout>
          )}
        </DataCard>
      )}
    </div>
  );
}
