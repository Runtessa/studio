import type { FormEventHandler } from 'react';
import { DataCard } from '@/components/ui/DataCard';
import { FormLayout } from '@/components/ui/FormLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';

type TeamSettingsCardProps = {
  value: {
    name: string;
    key: string;
    description: string;
    isActive: boolean;
  };
  createdAt: string;
  busyAction: string;
  onChange: (next: Partial<TeamSettingsCardProps['value']>) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onDelete: () => void;
};

export function TeamSettingsCard({
  value,
  createdAt,
  busyAction,
  onChange,
  onSubmit,
  onDelete,
}: TeamSettingsCardProps) {
  return (
    <DataCard
      title="Team settings"
      subtitle="Identity, operational scope, and lifecycle state for this ownership group."
    >
      <FormLayout
        onSubmit={onSubmit}
        actions={
          <>
            <Button type="button" variant="danger" disabled={Boolean(busyAction)} onClick={onDelete}>
              {busyAction === 'delete-team' ? 'Deleting...' : 'Delete Team'}
            </Button>
            <Button type="submit" variant="primary" disabled={Boolean(busyAction)}>
              {busyAction === 'save-team' ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgApp p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-textPrimary">Identity</h3>
              <p className="text-xs text-textMuted">
                Keep the team name stable and use the key as the durable internal ownership handle.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Team name"
                value={value.name}
                onChange={(event) => onChange({ name: event.target.value })}
                required
              />
              <Input
                label="Team key"
                value={value.key}
                onChange={(event) => onChange({ key: event.target.value })}
                required
                helperText="Use a stable key. Changing it affects internal references and admin lookups."
              />
              <div className="md:col-span-2">
                <TextArea
                  label="Description"
                  value={value.description}
                  onChange={(event) => onChange({ description: event.target.value })}
                  rows={5}
                  helperText="Clarify ownership boundaries, review scope, and who should work through this team."
                />
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgSurface p-5">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-textPrimary">Lifecycle</h3>
                <p className="text-xs text-textMuted">
                  Control whether this team should be used for active assignments.
                </p>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-borderSubtle bg-bgApp px-4 py-3">
                <input
                  type="checkbox"
                  checked={value.isActive}
                  onChange={(event) => onChange({ isActive: event.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-borderSubtle text-accent focus:ring-accent/30"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-textPrimary">Team is active</span>
                  <span className="block text-xs text-textMuted">
                    Inactive teams stay visible but should not receive new members, tenants, or ownership decisions.
                  </span>
                </span>
              </label>
            </section>

            <section className="space-y-3 rounded-2xl border border-borderSubtle bg-bgSurface p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-textMuted">Metadata</div>
              <div className="rounded-xl border border-borderSubtle bg-bgApp px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-textMuted">Created</div>
                <div className="mt-1 text-sm font-medium text-textPrimary">{createdAt}</div>
              </div>
            </section>
          </div>
        </div>
      </FormLayout>
    </DataCard>
  );
}

export default TeamSettingsCard;
