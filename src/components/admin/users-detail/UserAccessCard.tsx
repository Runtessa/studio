import { DataCard } from '@/components/ui/DataCard';

type UserAccessCardProps = {
  roleLabel: string;
  roleDescription: string;
  permissions: string[];
};

export function UserAccessCard({
  roleLabel,
  roleDescription,
  permissions,
}: UserAccessCardProps) {
  return (
    <DataCard title="Access profile" subtitle="Read-only view of the permissions granted by the current role.">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)]">
        <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgApp p-5">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-textPrimary">Assigned role</h3>
            <p className="text-xs text-textMuted">
              This section reflects the current role selection immediately, even before saving.
            </p>
          </div>
          <div className="rounded-xl border border-borderSubtle bg-bgSurface px-4 py-3">
            <div className="text-sm font-semibold text-textPrimary">{roleLabel}</div>
            <div className="mt-1 text-xs text-textMuted">{roleDescription}</div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgSurface p-5">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-textPrimary">Granted permissions</h3>
            <p className="text-xs text-textMuted">
              Exact IDE permission domains enabled by the assigned role blueprint.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {permissions.map((permission) => (
              <div
                key={permission}
                className="rounded-xl border border-borderSubtle bg-bgApp px-3 py-2 font-mono text-xs text-textPrimary"
              >
                {permission}
              </div>
            ))}
          </div>
        </section>
      </div>
    </DataCard>
  );
}

export default UserAccessCard;
