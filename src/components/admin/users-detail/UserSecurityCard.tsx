import type { FormEventHandler } from 'react';
import { DataCard } from '@/components/ui/DataCard';
import { FormLayout } from '@/components/ui/FormLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type UserSecurityCardProps = {
  password: string;
  token: string;
  passwordError?: string;
  onPasswordChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onGenerateToken: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function UserSecurityCard({
  password,
  token,
  passwordError,
  onPasswordChange,
  onTokenChange,
  onGenerateToken,
  onSubmit,
}: UserSecurityCardProps) {
  return (
    <DataCard title="Security" subtitle="Reset password and manage the user API token.">
      <FormLayout onSubmit={onSubmit} actions={<Button type="submit" variant="primary">Save changes</Button>}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
          <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgApp p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-textPrimary">Password reset</h3>
              <p className="text-xs text-textMuted">
                Leave the password field blank if the current password should remain unchanged.
              </p>
            </div>
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Leave blank to keep current"
              error={passwordError}
            />
          </section>

          <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgSurface p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-textPrimary">API token</h3>
              <p className="text-xs text-textMuted">
                Use this token for scripted or extension-based access that authenticates outside the browser session.
              </p>
            </div>
            <Input
              label="Token"
              value={token}
              onChange={(event) => onTokenChange(event.target.value)}
            />
            <div className="flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={onGenerateToken}>
                Generate token
              </Button>
            </div>
          </section>
        </div>
      </FormLayout>
    </DataCard>
  );
}

export default UserSecurityCard;
