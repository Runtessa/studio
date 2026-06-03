import type { FormEventHandler } from 'react';
import { DataCard } from '@/components/ui/DataCard';
import { FormLayout } from '@/components/ui/FormLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

type UserSettingsCardProps = {
  email: string;
  role: string;
  roleOptions: Array<{ label: string; value: string }>;
  roleDescription: string;
  roleError?: string;
  onRoleChange: (role: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function UserSettingsCard({
  email,
  role,
  roleOptions,
  roleDescription,
  roleError,
  onRoleChange,
  onSubmit,
}: UserSettingsCardProps) {
  return (
    <DataCard title="User settings" subtitle="Identity and top-level IDE role assignment.">
      <FormLayout onSubmit={onSubmit} actions={<Button type="submit" variant="primary">Save changes</Button>}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgApp p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-textPrimary">Identity</h3>
              <p className="text-xs text-textMuted">
                Email is the durable identity key for this managed admin user.
              </p>
            </div>
            <Input label="Email" value={email} disabled error={roleError} helperText="Email cannot be changed here." />
            <Select
              label="Role"
              value={role}
              options={roleOptions}
              onChange={(event) => onRoleChange(event.target.value)}
            />
          </section>

          <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgSurface p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-textPrimary">Role scope</h3>
              <p className="text-xs text-textMuted">
                Changing the role immediately changes the permissions summarized in the access tab.
              </p>
            </div>
            <div className="rounded-xl border border-borderSubtle bg-bgApp px-4 py-3 text-sm text-textPrimary">
              {roleDescription}
            </div>
          </section>
        </div>
      </FormLayout>
    </DataCard>
  );
}

export default UserSettingsCard;
