import { Input } from '@/components/ui/Input';
import type { TenantPwaFormState } from '@/components/admin/tenants/types';

type TenantPwaFieldsProps = {
  value: TenantPwaFormState;
  onChange: (value: TenantPwaFormState) => void;
};

export function TenantPwaFields({ value, onChange }: TenantPwaFieldsProps) {
  const setField = (patch: Partial<TenantPwaFormState>) => onChange({ ...value, ...patch });

  return (
    <div className="md:col-span-2 rounded-lg border border-borderSubtle bg-bgApp p-4">
      <label className="flex items-center gap-2 text-sm font-medium text-textPrimary">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => setField({ enabled: event.target.checked })}
          className="h-4 w-4 rounded border-borderSubtle text-accent focus:ring-accent/30"
        />
        Enable PWA install support
      </label>
      <p className="mt-1 text-xs text-textMuted">
        Adds a tenant manifest and service worker so browsers can install this tenant as an app.
      </p>
      {value.enabled ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            label="App name"
            placeholder="Tenant Portal"
            value={value.name}
            onChange={(event) => setField({ name: event.target.value })}
          />
          <Input
            label="Short name"
            placeholder="Portal"
            value={value.shortName}
            onChange={(event) => setField({ shortName: event.target.value })}
          />
          <Input
            label="Theme color"
            placeholder="#121212"
            value={value.themeColor}
            onChange={(event) => setField({ themeColor: event.target.value })}
          />
          <Input
            label="Background color"
            placeholder="#121212"
            value={value.backgroundColor}
            onChange={(event) => setField({ backgroundColor: event.target.value })}
          />
          <Input
            label="Start URL"
            placeholder="/"
            value={value.startUrl}
            onChange={(event) => setField({ startUrl: event.target.value })}
          />
          <Input
            label="Scope"
            placeholder="/"
            value={value.scope}
            onChange={(event) => setField({ scope: event.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
