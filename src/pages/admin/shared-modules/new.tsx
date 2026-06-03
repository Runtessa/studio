import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataCard } from '@/components/ui/DataCard';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { fetchJson } from '@/lib/client/api';
import { useSessionToken } from '@/lib/client/session';
import { hasPermissionFromUser } from '@/lib/client/access';
import { SharedModuleProjectCard } from '@/components/admin/shared-modules/SharedModuleProjectCard';
import {
  DEFAULT_PROJECT_FORM,
  hasProjectErrors,
  parseDeps,
  validateProjectForm,
  type ProjectFormErrors,
  type ProjectFormState,
} from '@/components/admin/shared-modules/model';

export default function AdminSharedModuleCreatePage() {
  const router = useRouter();
  const { token, setToken, ready } = useSessionToken();
  const { success, error: showError } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ProjectFormState>(DEFAULT_PROJECT_FORM);
  const [validationErrors, setValidationErrors] = useState<ProjectFormErrors>({
    name: '',
    version: '',
    entryPath: '',
  });

  useEffect(() => {
    const bootstrap = async () => {
      if (!ready || !token) return;
      try {
        const meRes = await fetch('/api/me', { headers: { Authorization: `Session ${token}` } });
        const meData = await meRes.json();
        if (!meRes.ok) throw new Error(meData.error || 'Failed to load user');
        const canWrite = hasPermissionFromUser(meData.user, 'ide.shared_modules.write');
        setIsAdmin(canWrite);
        if (!canWrite) router.replace('/dashboard');
      } catch (err: any) {
        setError(err.message);
        if (err.message?.toLowerCase().includes('unauthorized')) setToken('');
      }
    };
    void bootstrap();
  }, [token, ready, setToken, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const errors = validateProjectForm(form);
    setValidationErrors(errors);
    if (hasProjectErrors(errors)) return;
    try {
      await fetchJson('/api/admin/shared-modules', {
        method: 'POST',
        token,
        body: {
          name: form.name,
          version: form.version,
          entryPath: form.entryPath,
          dependencies: parseDeps(form.dependencies),
          fileExtension: form.fileExtension || 'js',
        },
      });
      success('Shared backend project created');
      router.push('/admin/shared-modules');
    } catch (err: any) {
      showError(err.message || 'Failed to create shared backend project');
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
        <PageHeader title="Create shared backend" subtitle="You do not have access to shared backend projects." />
        <DataCard title="Permission Denied" subtitle="Please contact an administrator." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create shared backend"
        subtitle="Add a reusable backend package."
        actions={
          <Button variant="secondary" size="sm" href="/admin/shared-modules">
            Back to shared backends
          </Button>
        }
      />

      {error ? (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      <SharedModuleProjectCard
        title="Project details"
        subtitle="Define shared backend metadata and runtime entry information."
        form={form}
        errors={validationErrors}
        submitLabel="Create project"
        onChange={(next) => setForm((current) => ({ ...current, ...next }))}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
