import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataCard } from '@/components/ui/DataCard';
import { FormLayout } from '@/components/ui/FormLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { useAdminGuard } from '@/lib/client/use-admin-guard';
import { createTeam } from '@/lib/client/teams-admin';
import { AccessTabs } from '@/components/admin/AccessTabs';

const buildKeyPreview = (name: string, key: string) => {
  const source = key.trim() || name.trim();
  if (!source) return 'team-key';
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'team-key';
};

export default function AdminTeamNewPage() {
  const router = useRouter();
  const { token, ready, isAdmin, loading: authLoading, error: authError } = useAdminGuard('ide.users.manage');

  const [form, setForm] = useState({
    name: '',
    key: '',
    description: '',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const keyPreview = buildKeyPreview(form.name, form.key);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (!form.name.trim()) {
      setError('Team name is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await createTeam(token, {
        name: form.name.trim(),
        key: form.key.trim() || undefined,
        description: form.description.trim(),
        isActive: form.isActive,
      });
      router.push(`/admin/teams/${result.team.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create team');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AccessTabs />
      <PageHeader
        title="Create Team"
        subtitle="Define a team and start assigning users."
        actions={
          <Button href="/admin/teams" variant="secondary" size="sm">
            Back to Teams
          </Button>
        }
      />

      {authLoading ? <DataCard title="Loading" subtitle="Please wait..." /> : null}
      {authError ? (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">{authError}</div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      {ready && isAdmin ? (
        <DataCard
          title="Team profile"
          subtitle="Define the team identity, ownership context, and lifecycle state."
        >
          <FormLayout
            onSubmit={handleSubmit}
            actions={
              <>
                <Button variant="secondary" href="/admin/teams">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Team'}
                </Button>
              </>
            }
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="space-y-5">
                <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgApp p-5">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-textPrimary">Identity</h3>
                    <p className="text-xs text-textMuted">
                      Public team name and stable key used in internal ownership workflows.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Team name"
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Frontend Guild"
                      required
                      helperText="The human-readable name shown across admin and access screens."
                    />
                    <Input
                      label="Team key"
                      value={form.key}
                      onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
                      placeholder="frontend-guild"
                      helperText="Optional. If omitted, a normalized key is generated from the team name."
                    />
                    <div className="md:col-span-2">
                      <TextArea
                        label="Description"
                        value={form.description}
                        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                        rows={5}
                        placeholder="What this team owns, scope, and handoff boundaries."
                        helperText="Use this to clarify ownership, review scope, and operational boundaries."
                      />
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-5">
                <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgApp p-5">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-textPrimary">Lifecycle</h3>
                    <p className="text-xs text-textMuted">
                      Control whether the team is immediately usable for assignments and access management.
                    </p>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-borderSubtle bg-bgSurface px-4 py-3">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      className="mt-1 h-4 w-4 rounded border-borderSubtle text-accent focus:ring-accent/30"
                    />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium text-textPrimary">Team is active</span>
                      <span className="block text-xs text-textMuted">
                        Inactive teams remain in the system but should not be used for new ownership decisions.
                      </span>
                    </span>
                  </label>
                </section>

                <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgSurface p-5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-textMuted">Preview</div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-textPrimary">
                        {form.name.trim() || 'New team'}
                      </div>
                      <div className="mt-1 text-xs text-textMuted">
                        This is how the team will appear in admin ownership screens.
                      </div>
                    </div>
                    <div className="rounded-xl border border-borderSubtle bg-bgApp px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-textMuted">Resolved key</div>
                      <div className="mt-1 font-mono text-sm text-textPrimary">{keyPreview}</div>
                    </div>
                    <div className="rounded-xl border border-borderSubtle bg-bgApp px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-textMuted">State</div>
                      <div className="mt-1 text-sm font-semibold text-textPrimary">
                        {form.isActive ? 'Active from creation' : 'Created inactive'}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </FormLayout>
        </DataCard>
      ) : null}
    </div>
  );
}
