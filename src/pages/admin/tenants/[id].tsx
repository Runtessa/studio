import { useRouter } from 'next/router';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataCard } from '@/components/ui/DataCard';
import { Button } from '@/components/ui/Button';
import { FiCheck, FiX, FiInfo, FiClock, FiUser, FiMessageSquare } from 'react-icons/fi';
import { useApi } from '@/lib/api';
import { TenantAdapterConfigEditor } from '@/components/admin/tenants/TenantAdapterConfigEditor';
import { TenantCoreSettingsForm } from '@/components/admin/tenants/TenantCoreSettingsForm';
import { TenantBrandingForm } from '@/components/admin/tenants/TenantBrandingForm';
import { TenantPwaManifestEditor } from '@/components/admin/tenants/TenantPwaManifestEditor';
import { TenantSecretsManager } from '@/components/admin/tenants/TenantSecretsManager';
import { TenantSettingsTabs } from '@/components/admin/tenants/TenantSettingsTabs';
import { TenantTabFormCard } from '@/components/admin/tenants/TenantTabFormCard';
import { TenantPwaFields } from '@/components/admin/tenants/TenantPwaFields';
import { TenantWorkspaceSummary } from '@/components/admin/tenants/TenantWorkspaceSummary';
import { useTenantEditor } from '@/components/admin/tenants/useTenantEditor';

export default function AdminTenantEditPage() {
  const router = useRouter();
  const {
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
  } = useTenantEditor();

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

      <TenantWorkspaceSummary
        hostname={form.hostname}
        mode="edit"
        isSuspended={form.isSuspended}
        allowRegistration={form.allowRegistration}
        authDbMode={form.authDbMode}
        pwaEnabled={form.pwa.enabled}
      />

      <TenantSettingsTabs activeTab={activeTab} onChange={handleTabChange} tenantId={tenantId} />

      {activeTab === 'tenant' ? (
        <TenantTabFormCard
          title="Tenant configuration"
          subtitle="Core tenant identity, access posture, runtime limits, and auth storage."
          loading={loading}
          loadingLabel="Loading tenant data…"
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
          <TenantCoreSettingsForm
            value={form}
            errors={{
              hostname: validationErrors.hostname,
              memory: validationErrors.memory,
              timeout: validationErrors.timeout,
              authDbSecretKey: validationErrors.authDbSecretKey,
            }}
            showSso
            onChange={(next) => setForm((current) => ({ ...current, ...next }))}
          />
        </TenantTabFormCard>
      ) : activeTab === 'branding' ? (
        <TenantTabFormCard
          title="Branding"
          subtitle="Application name and browser icons used by the tenant shell."
          loading={loading}
          loadingLabel="Loading branding…"
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
        </TenantTabFormCard>
      ) : activeTab === 'pwa' ? (
        <TenantTabFormCard
          title="PWA"
          subtitle="Installable app behavior, manifest fields, and raw manifest JSON."
          loading={loading}
          loadingLabel="Loading PWA settings…"
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
        </TenantTabFormCard>
      ) : activeTab === 'adapters' ? (
        <TenantTabFormCard
          title="Adapter configuration"
          subtitle="Runtime adapter map and secret-reference wiring for this tenant."
          loading={loading}
          loadingLabel="Loading adapter config…"
          onSubmit={handleAdapterSubmit}
          actions={
            <Button type="submit" variant="primary">
              Save adapter configuration
            </Button>
          }
        >
          <TenantAdapterConfigEditor
            value={adapterConfigText}
            error={validationErrors.adapterConfig}
            expanded={editorExpanded}
            secrets={tenantSecrets.map((secret) => secret.keyName)}
            onToggleExpanded={() => setEditorExpanded((current) => !current)}
            onChange={setAdapterConfigText}
          />
        </TenantTabFormCard>
      ) : (
        <TenantSecretsManager
          loading={loading}
          canWrite={canWrite}
          secrets={tenantSecrets}
          form={secretForm}
          saving={secretSaving}
          editorExpanded={secretEditorExpanded}
          onFormChange={setSecretForm}
          onToggleExpanded={() => setSecretEditorExpanded((current) => !current)}
          onSubmit={handleSecretSave}
          onDelete={handleSecretDelete}
        />
      )}
    </div>
  );
}
