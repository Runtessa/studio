import type React from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

type TenantCoreSettingsValue = {
  hostname: string;
  isSuspended: boolean;
  allowRegistration: boolean;
  ssoEnabled?: boolean;
  memory: string;
  timeout: string;
  authDbMode: 'shared' | 'dedicated';
  authDbSecretKey: string;
};

type TenantCoreSettingsErrors = {
  hostname: string;
  memory: string;
  timeout: string;
  authDbSecretKey: string;
};

type TenantCoreSettingsFormProps = {
  value: TenantCoreSettingsValue;
  errors: TenantCoreSettingsErrors;
  showSso?: boolean;
  onChange: (value: TenantCoreSettingsValue) => void;
};

type ToggleCardProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleCard({ label, description, checked, onChange }: ToggleCardProps) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-borderSubtle bg-bgApp px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-borderSubtle text-accent focus:ring-accent/30"
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium text-textPrimary">{label}</span>
        <span className="block text-xs text-textMuted">{description}</span>
      </span>
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-borderSubtle bg-bgApp p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-textPrimary">{title}</h4>
        <p className="text-xs text-textMuted">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function TenantCoreSettingsForm({
  value,
  errors,
  showSso = false,
  onChange,
}: TenantCoreSettingsFormProps) {
  const setPatch = (patch: Partial<TenantCoreSettingsValue>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
      <div className="space-y-5">
        <Section
          title="Identity"
          description="Primary tenant address and public access posture."
        >
          <div className="grid gap-4">
            <Input
              label="Hostname"
              placeholder="tenant.example.com"
              value={value.hostname}
              onChange={(event) => setPatch({ hostname: event.target.value })}
              error={errors.hostname}
              helperText="Used as the tenant host and the default runtime title fallback."
            />
          </div>
        </Section>

        <Section
          title="Runtime Budget"
          description="Execution memory and timeout limits for tenant backend workloads."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Memory (MB)"
              type="number"
              min="1"
              step="64"
              value={value.memory}
              onChange={(event) => setPatch({ memory: event.target.value })}
              error={errors.memory}
            />
            <Input
              label="Timeout (ms)"
              type="number"
              min="1"
              step="100"
              value={value.timeout}
              onChange={(event) => setPatch({ timeout: event.target.value })}
              error={errors.timeout}
            />
          </div>
        </Section>
      </div>

      <div className="space-y-5">
        <Section
          title="Access Flags"
          description="Operational switches that affect availability and sign-up behavior."
        >
          <div className="space-y-3">
            <ToggleCard
              label="Suspended"
              description="Blocks tenant runtime access without deleting configuration."
              checked={value.isSuspended}
              onChange={(checked) => setPatch({ isSuspended: checked })}
            />
            <ToggleCard
              label="Allow registration"
              description="Controls whether tenant-facing sign-up remains open."
              checked={value.allowRegistration}
              onChange={(checked) => setPatch({ allowRegistration: checked })}
            />
            {showSso ? (
              <ToggleCard
                label="Enable SSO"
                description="Registers and uses the auth-service OAuth flow for this tenant."
                checked={Boolean(value.ssoEnabled)}
                onChange={(checked) => setPatch({ ssoEnabled: checked })}
              />
            ) : null}
          </div>
        </Section>

        <Section
          title="Auth Storage"
          description="Choose whether tenant authentication uses the shared user database or a dedicated secret."
        >
          <div className="grid gap-4">
            <Select
              label="Auth DB mode"
              value={value.authDbMode}
              options={[
                { value: 'shared', label: 'Shared global database' },
                { value: 'dedicated', label: 'Dedicated tenant secret' },
              ]}
              onChange={(event) =>
                setPatch({
                  authDbMode: event.target.value === 'dedicated' ? 'dedicated' : 'shared',
                })
              }
            />
            <Input
              label="Auth DB secret key"
              placeholder="userdb:tenant-a"
              value={value.authDbSecretKey}
              onChange={(event) => setPatch({ authDbSecretKey: event.target.value })}
              error={errors.authDbSecretKey}
              disabled={value.authDbMode !== 'dedicated'}
              helperText="Only required when dedicated mode is selected."
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

export default TenantCoreSettingsForm;
