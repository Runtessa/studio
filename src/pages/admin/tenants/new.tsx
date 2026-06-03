import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataCard } from '@/components/ui/DataCard';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { fetchJson } from '@/lib/client/api';
import { useSessionToken } from '@/lib/client/session';
import { hasPermissionFromUser } from '@/lib/client/access';
import { TenantAdapterConfigEditor } from '@/components/admin/tenants/TenantAdapterConfigEditor';
import { TenantCoreSettingsForm } from '@/components/admin/tenants/TenantCoreSettingsForm';
import { DEFAULT_ADAPTER_CONFIG_TEMPLATE } from '@/lib/tenant-adapter-config';
import { TenantBrandingForm, type TenantBrandingFormState } from '@/components/admin/tenants/TenantBrandingForm';
import { TenantPwaManifestEditor } from '@/components/admin/tenants/TenantPwaManifestEditor';
import { TenantSettingsTabs } from '@/components/admin/tenants/TenantSettingsTabs';
import { TenantTabFormCard } from '@/components/admin/tenants/TenantTabFormCard';
import { TenantPwaFields } from '@/components/admin/tenants/TenantPwaFields';
import { TenantWorkspaceSummary } from '@/components/admin/tenants/TenantWorkspaceSummary';
import type { TenantPwaFormState } from '@/components/admin/tenants/types';
import { parseTenantPwaManifest, serializeTenantPwaManifest } from '@/lib/tenant-pwa-manifest';
import {
  emptyTenantConfigErrors,
  hasTenantConfigErrors,
  parseAdapterConfigText,
  validateTenantConfigForm,
  type TenantConfigFormErrors,
} from '@/lib/tenant-config-validation';

type TenantFormState = {
  hostname: string;
  isSuspended: boolean;
  allowRegistration: boolean;
  memory: string;
  timeout: string;
  authDbMode: 'shared' | 'dedicated';
  authDbSecretKey: string;
  branding: TenantBrandingFormState;
  pwa: TenantPwaFormState;
};

const DEFAULT_FORM: TenantFormState = {
  hostname: '',
  isSuspended: false,
  allowRegistration: true,
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

export default function AdminTenantCreatePage() {
  const router = useRouter();
  const { token, setToken, ready } = useSessionToken();
  const { success, error: showError } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<TenantFormState>(DEFAULT_FORM);
  const [adapterConfigText, setAdapterConfigText] = useState(DEFAULT_CONFIG_TEXT);
  const [activeTab, setActiveTab] = useState<'tenant' | 'branding' | 'pwa' | 'adapters'>('tenant');
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [pwaEditorExpanded, setPwaEditorExpanded] = useState(false);
  const [pwaManifestText, setPwaManifestText] = useState(() => serializeTenantPwaManifest(DEFAULT_FORM.pwa));
  const [pwaManifestError, setPwaManifestError] = useState('');
  const [validationErrors, setValidationErrors] = useState<TenantConfigFormErrors>(() =>
    emptyTenantConfigErrors()
  );

  useEffect(() => {
    const bootstrap = async () => {
      if (!ready || !token) return;
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
        }
      } catch (err: any) {
        setError(err.message);
        if (err.message?.toLowerCase().includes('unauthorized')) {
          setToken('');
        }
      }
    };
    bootstrap();
  }, [ready, token, router, setToken]);

  const buildPayload = (values: TenantFormState, configText?: string) => ({
    hostname: values.hostname.trim(),
    isSuspended: values.isSuspended,
    allowRegistration: values.allowRegistration,
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
    adapterConfig: configText ? parseAdapterConfigText(configText) : undefined,
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

  const handleTabChange = (tab: 'tenant' | 'branding' | 'pwa' | 'adapters' | 'secrets') => {
    if (tab === 'secrets') return;
    setActiveTab(tab);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const errors = validateTenantConfigForm(form, adapterConfigText);
    setValidationErrors(errors);
    if (hasTenantConfigErrors(errors)) return;
    if (!token) return;

    try {
      const payload = buildPayload(form, adapterConfigText);
      const data = await fetchJson('/api/admin/tenants', {
        method: 'POST',
        token,
        body: payload,
      });
      success(`Created tenant ${data?.tenant?.hostname || payload.hostname}`);
      router.push('/admin/tenants');
    } catch (err: any) {
      showError(err.message || 'Failed to create tenant');
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
        <PageHeader title="Create tenant" subtitle="You do not have access to tenant management." />
        <DataCard title="Permission Denied" subtitle="Please contact an administrator." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create tenant"
        subtitle="Provision a new tenant and configure adapters."
        actions={
          <Button variant="secondary" size="sm" href="/admin/tenants">
            Back to tenants
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <TenantWorkspaceSummary
        hostname={form.hostname}
        mode="create"
        isSuspended={form.isSuspended}
        allowRegistration={form.allowRegistration}
        authDbMode={form.authDbMode}
        pwaEnabled={form.pwa.enabled}
      />

      <TenantSettingsTabs activeTab={activeTab} onChange={handleTabChange} />

      {activeTab === 'tenant' ? (
        <TenantTabFormCard
          title="Tenant configuration"
          subtitle="Core tenant identity, access posture, runtime limits, and auth storage."
          onSubmit={handleSubmit}
          actions={
            <>
              <Button variant="secondary" href="/admin/tenants">
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create tenant
              </Button>
            </>
          }
        >
          <TenantCoreSettingsForm
            value={form}
            errors={{
              hostname: validationErrors.hostname,
              memory: validationErrors.memory,
              timeout: validationErrors.timeout,
              authDbSecretKey: validationErrors.authDbSecretKey,
            }}
            onChange={(next) => setForm((current) => ({ ...current, ...next }))}
          />
        </TenantTabFormCard>
      ) : activeTab === 'branding' ? (
        <TenantTabFormCard
          title="Branding"
          subtitle="Application name and browser icons used by the tenant shell."
          onSubmit={handleSubmit}
          actions={
            <>
              <Button variant="secondary" href="/admin/tenants">
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create tenant
              </Button>
            </>
          }
        >
          <TenantBrandingForm
            value={form.branding}
            onChange={(branding) => setForm({ ...form, branding })}
          />
        </TenantTabFormCard>
      ) : activeTab === 'pwa' ? (
        <TenantTabFormCard
          title="PWA"
          subtitle="Installable app behavior, manifest fields, and raw manifest JSON."
          onSubmit={handleSubmit}
          actions={
            <>
              <Button variant="secondary" href="/admin/tenants">
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create tenant
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
        </TenantTabFormCard>
      ) : (
        <TenantTabFormCard
          title="Adapter configuration"
          subtitle="Runtime adapter map and secret-reference wiring for this tenant."
          onSubmit={handleSubmit}
          actions={
            <>
              <Button variant="secondary" href="/admin/tenants">
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create tenant
              </Button>
            </>
          }
        >
          <TenantAdapterConfigEditor
            value={adapterConfigText}
            error={validationErrors.adapterConfig}
            expanded={editorExpanded}
            secrets={[]}
            onToggleExpanded={() => setEditorExpanded((current) => !current)}
            onChange={setAdapterConfigText}
          />
        </TenantTabFormCard>
      )}
    </div>
  );
}
