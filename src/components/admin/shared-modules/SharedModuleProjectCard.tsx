import type { FormEventHandler } from 'react';
import { DataCard } from '@/components/ui/DataCard';
import { FormLayout } from '@/components/ui/FormLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import {
  FILE_EXTENSION_OPTIONS,
  type ProjectFormErrors,
  type ProjectFormState,
} from './model';

type SharedModuleProjectCardProps = {
  title: string;
  subtitle: string;
  form: ProjectFormState;
  errors: ProjectFormErrors;
  loading?: boolean;
  canEdit?: boolean;
  submitLabel: string;
  onChange: (next: Partial<ProjectFormState>) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function SharedModuleProjectCard({
  title,
  subtitle,
  form,
  errors,
  loading = false,
  canEdit = true,
  submitLabel,
  onChange,
  onSubmit,
}: SharedModuleProjectCardProps) {
  return (
    <DataCard title={title} subtitle={subtitle}>
      {loading ? (
        <div className="text-sm text-textMuted">Loading project…</div>
      ) : (
        <FormLayout
          onSubmit={onSubmit}
          actions={<Button type="submit" variant="primary" disabled={!canEdit}>{submitLabel}</Button>}
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgApp p-5">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-textPrimary">Package identity</h3>
                <p className="text-xs text-textMuted">
                  Core module metadata used by registry resolution and backend package loading.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Name"
                  value={form.name}
                  onChange={(event) => onChange({ name: event.target.value })}
                  error={errors.name}
                  disabled={!canEdit}
                />
                <Input
                  label="Version"
                  value={form.version}
                  onChange={(event) => onChange({ version: event.target.value })}
                  error={errors.version}
                  disabled={!canEdit}
                />
                <Input
                  label="Entry file"
                  value={form.entryPath}
                  onChange={(event) => onChange({ entryPath: event.target.value })}
                  error={errors.entryPath}
                  placeholder="src/index.js"
                  disabled={!canEdit}
                />
                <Select
                  label="File extension"
                  value={form.fileExtension}
                  options={FILE_EXTENSION_OPTIONS}
                  onChange={(event) => onChange({ fileExtension: event.target.value })}
                  disabled={!canEdit}
                />
                <div className="md:col-span-2">
                  <TextArea
                    label="Dependencies"
                    placeholder="one per line or comma-separated"
                    rows={6}
                    value={form.dependencies}
                    onChange={(event) => onChange({ dependencies: event.target.value })}
                    disabled={!canEdit}
                    helperText="List runtime dependencies only. Keep this aligned with what the shared backend actually imports."
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgSurface p-5">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-textPrimary">Operational notes</h3>
                <p className="text-xs text-textMuted">
                  Shared backends are reusable server-side modules. Stable naming and entry paths matter more here than cosmetics.
                </p>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-borderSubtle bg-bgApp px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-textMuted">Resolved package</div>
                  <div className="mt-1 font-mono text-sm text-textPrimary">
                    {(form.name.trim() || 'shared-backend') + '@' + (form.version.trim() || '0.0.0')}
                  </div>
                </div>
                <div className="rounded-xl border border-borderSubtle bg-bgApp px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-textMuted">Runtime entry</div>
                  <div className="mt-1 font-mono text-sm text-textPrimary">{form.entryPath || 'src/index.js'}</div>
                </div>
                {!canEdit ? (
                  <p className="text-xs text-textMuted">
                    Read-only view: this shared backend is outside your owner or granted team scope.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </FormLayout>
      )}
    </DataCard>
  );
}

export default SharedModuleProjectCard;
