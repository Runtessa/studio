import { Input } from '@/components/ui/Input';
import type { TenantPwaFieldErrors, TenantPwaFormState } from '@/lib/tenant-config-validation';

type TenantPwaFieldsProps = {
  value: TenantPwaFormState;
  errors?: TenantPwaFieldErrors;
  onChange: (value: TenantPwaFormState) => void;
};

export function TenantPwaFields({ value, errors = {}, onChange }: TenantPwaFieldsProps) {
  const setField = (patch: Partial<TenantPwaFormState>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-5 rounded-2xl border border-borderSubtle bg-bgApp p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-textPrimary">Installable App</div>
          <p className="text-xs text-textMuted">
            Adds a tenant manifest and service worker so browsers can install this tenant as an app.
          </p>
        </div>
        <label className="inline-flex items-center gap-3 rounded-xl border border-borderSubtle bg-bgSurface px-3 py-2 text-sm font-medium text-textPrimary">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(event) => setField({ enabled: event.target.checked })}
            className="h-4 w-4 rounded border-borderSubtle text-accent focus:ring-accent/30"
          />
          {value.enabled ? 'PWA enabled' : 'PWA disabled'}
        </label>
      </div>
      {value.enabled ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-borderSubtle bg-bgSurface p-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-textPrimary">Application Identity</h4>
              <p className="text-xs text-textMuted">User-facing labels shown during installation and launch.</p>
            </div>
            <div className="grid gap-4">
              <Input
                label="App name"
                placeholder="Tenant Portal"
                value={value.name}
                onChange={(event) => setField({ name: event.target.value })}
                error={errors.name}
                helperText="Optional. Falls back to branding title or hostname."
              />
              <Input
                label="Short name"
                placeholder="Portal"
                value={value.shortName}
                onChange={(event) => setField({ shortName: event.target.value })}
                error={errors.shortName}
                helperText="Maximum 32 characters."
              />
              <Input
                label="Description"
                placeholder="Installable tenant application"
                value={value.description}
                onChange={(event) => setField({ description: event.target.value })}
                error={errors.description}
              />
            </div>
          </section>
          <section className="space-y-4 rounded-xl border border-borderSubtle bg-bgSurface p-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-textPrimary">Launch Behavior</h4>
              <p className="text-xs text-textMuted">Routing and display mode used by the installed app shell.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-textPrimary">Display mode</label>
                <select
                  value={value.display}
                  onChange={(event) =>
                    setField({
                      display:
                        event.target.value === 'fullscreen' ||
                        event.target.value === 'minimal-ui' ||
                        event.target.value === 'browser'
                          ? event.target.value
                          : 'standalone',
                    })
                  }
                  className="w-full rounded-md border border-borderSubtle bg-bgSurface px-3 py-2 text-sm text-textPrimary focus:border-accent focus:outline-none"
                >
                  <option value="standalone">Standalone</option>
                  <option value="fullscreen">Fullscreen</option>
                  <option value="minimal-ui">Minimal UI</option>
                  <option value="browser">Browser</option>
                </select>
                {errors.display ? <p className="mt-1 text-xs text-danger">{errors.display}</p> : null}
              </div>
              <Input
                label="Start URL"
                placeholder="/"
                value={value.startUrl}
                onChange={(event) => setField({ startUrl: event.target.value })}
                error={errors.startUrl}
              />
              <Input
                label="Scope"
                placeholder="/"
                value={value.scope}
                onChange={(event) => setField({ scope: event.target.value })}
                error={errors.scope}
              />
              <Input
                label="Theme color"
                placeholder="#121212"
                value={value.themeColor}
                onChange={(event) => setField({ themeColor: event.target.value })}
                error={errors.themeColor}
              />
              <Input
                label="Background color"
                placeholder="#121212"
                value={value.backgroundColor}
                onChange={(event) => setField({ backgroundColor: event.target.value })}
                error={errors.backgroundColor}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
