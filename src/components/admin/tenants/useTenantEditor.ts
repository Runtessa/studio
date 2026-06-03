import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/ui/Toast';
import { fetchJson } from '@/lib/client/api';
import { hasPermissionFromUser } from '@/lib/client/access';
import { getSelectedTenantHost, setSelectedTenantHost } from '@/lib/client/tenant';
import { parseTenantPwaManifest, serializeTenantPwaManifest } from '@/lib/tenant-pwa-manifest';
import {
  emptyTenantConfigErrors,
  hasTenantCoreConfigErrors,
  validateAdapterConfigForm,
  validateTenantCoreConfigForm,
} from '@/lib/tenant-config-validation';
import { useSessionToken } from '@/lib/client/session';
import {
  buildAdapterEditorText,
  buildAdapterPayload,
  buildPwaManifestText,
  buildTenantPayload,
  DEFAULT_CONFIG_TEXT,
  DEFAULT_FORM,
  mapTenantToFormState,
  type TenantDetails,
} from './tenantEditorModel';

type TenantEditorTab = 'tenant' | 'branding' | 'pwa' | 'adapters' | 'secrets';

export function useTenantEditor() {
  const router = useRouter();
  const { token, setToken, ready } = useSessionToken();
  const { success, error: showError } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [tenantCanWrite, setTenantCanWrite] = useState(false);
  const [adapterConfigText, setAdapterConfigText] = useState(DEFAULT_CONFIG_TEXT);
  const [activeTab, setActiveTab] = useState<TenantEditorTab>('tenant');
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [pwaEditorExpanded, setPwaEditorExpanded] = useState(false);
  const [pwaManifestText, setPwaManifestText] = useState(() => serializeTenantPwaManifest(DEFAULT_FORM.pwa));
  const [pwaManifestError, setPwaManifestError] = useState('');
  const [secretEditorExpanded, setSecretEditorExpanded] = useState(false);
  const [secretForm, setSecretForm] = useState({ keyName: '', value: '' });
  const [secretSaving, setSecretSaving] = useState(false);
  const [tenantSecrets, setTenantSecrets] = useState<Array<{ keyName: string; updatedAt?: string }>>([]);
  const [validationErrors, setValidationErrors] = useState(() => emptyTenantConfigErrors());

  const tenantIdRaw = router.query.id;
  const tenantId = Array.isArray(tenantIdRaw) ? tenantIdRaw[0] : tenantIdRaw;
  const queryTab = useMemo(() => {
    const raw = router.query.tab;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [router.query.tab]);

  useEffect(() => {
    setActiveTab(
      queryTab === 'branding' || queryTab === 'pwa' || queryTab === 'adapters' || queryTab === 'secrets'
        ? queryTab
        : 'tenant'
    );
  }, [queryTab]);

  const loadTenantDetail = async (activeToken: string, activeTenantId: string) => {
    const detail = (await fetchJson(`/api/admin/tenants/${activeTenantId}`, {
      token: activeToken,
    })) as TenantDetails;
    const tenant = detail?.tenant;
    if (!tenant) throw new Error('Tenant not found');
    const secrets = detail?.secrets ?? [];

    setTenantCanWrite(Boolean(tenant.canWrite));
    setForm(mapTenantToFormState(tenant));
    setPwaManifestText(buildPwaManifestText(tenant));
    setTenantSecrets(secrets);
    setAdapterConfigText(buildAdapterEditorText(tenant, secrets));
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (!ready || !token || !tenantId) return;
      try {
        const meRes = await fetch('/api/me', {
          headers: { Authorization: `Session ${token}` },
        });
        const meData = await meRes.json();
        if (!meRes.ok) throw new Error(meData.error || 'Failed to load user');
        const canManage = hasPermissionFromUser(meData.user, 'ide.tenants.manage');
        setIsAdmin(canManage);
        if (!canManage) {
          router.replace('/dashboard');
          return;
        }
        await loadTenantDetail(token, tenantId);
      } catch (err: any) {
        setError(err.message);
        if (err.message?.toLowerCase().includes('unauthorized')) setToken('');
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, [ready, token, tenantId, router, setToken]);

  const handleTabChange = (tab: TenantEditorTab) => {
    setActiveTab(tab);
    if (!tenantId) return;
    void router.replace(
      { pathname: `/admin/tenants/${tenantId}`, query: tab === 'tenant' ? {} : { tab } },
      undefined,
      { shallow: true }
    );
  };

  const handlePwaFormChange = (pwa: typeof form.pwa) => {
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
    } catch (err: any) {
      setPwaManifestError(err.message || 'Manifest JSON is invalid');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const errors = validateTenantCoreConfigForm(form);
    setValidationErrors((current) => ({ ...errors, adapterConfig: current.adapterConfig }));
    if (hasTenantCoreConfigErrors(errors) || !form.id || !token) return;

    try {
      const payload = buildTenantPayload(form);
      const data = await fetchJson(`/api/admin/tenants/${form.id}`, { method: 'PUT', token, body: payload });
      const nextHostname = data?.tenant?.hostname || payload.hostname;
      success(`Updated tenant ${nextHostname}`);
      const selectedTenant = getSelectedTenantHost();
      if (selectedTenant && form.originalHostname === selectedTenant && nextHostname !== selectedTenant) {
        setSelectedTenantHost(nextHostname);
      }
      router.push('/admin/tenants');
    } catch (err: any) {
      showError(err.message || 'Failed to update tenant');
    }
  };

  const handleAdapterSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const errors = validateAdapterConfigForm(adapterConfigText);
    setValidationErrors((current) => ({ ...current, adapterConfig: errors.adapterConfig }));
    if (errors.adapterConfig || !form.id || !token) return;

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

  const canWrite = Boolean(form.id && token && tenantId && tenantCanWrite);

  const handleSecretSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !tenantId || !canWrite) return;
    if (!secretForm.keyName.trim()) return showError('Secret key is required');
    if (!secretForm.value.length) return showError('Secret value is required');

    setSecretSaving(true);
    try {
      await fetchJson(`/api/admin/tenants/${tenantId}/secrets`, {
        method: 'POST',
        token,
        body: { keyName: secretForm.keyName.trim(), value: secretForm.value },
      });
      success(`Saved secret ${secretForm.keyName.trim()}`);
      setSecretForm((current) => ({ ...current, value: '' }));
      await loadTenantDetail(token, tenantId);
    } catch (err: any) {
      showError(err.message || 'Failed to save secret');
    } finally {
      setSecretSaving(false);
    }
  };

  const handleSecretDelete = async (keyName: string) => {
    if (!token || !tenantId || !canWrite || !window.confirm(`Delete secret ${keyName}?`)) return;
    try {
      await fetchJson(`/api/admin/tenants/${tenantId}/secrets/${encodeURIComponent(keyName)}`, {
        method: 'DELETE',
        token,
      });
      success(`Deleted secret ${keyName}`);
      await loadTenantDetail(token, tenantId);
    } catch (err: any) {
      showError(err.message || 'Failed to delete secret');
    }
  };

  return {
    ready,
    token,
    isAdmin,
    error,
    loading,
    form,
    activeTab,
    editorExpanded,
    pwaEditorExpanded,
    pwaManifestText,
    pwaManifestError,
    secretEditorExpanded,
    secretForm,
    secretSaving,
    tenantSecrets,
    validationErrors,
    tenantId,
    canWrite,
    setForm,
    setEditorExpanded,
    setPwaEditorExpanded,
    setSecretEditorExpanded,
    setSecretForm,
    handleTabChange,
    handlePwaFormChange,
    handlePwaManifestChange,
    handleSubmit,
    handleAdapterSubmit,
    handleSecretSave,
    handleSecretDelete,
    setAdapterConfigText,
    adapterConfigText,
  };
}

export default useTenantEditor;
