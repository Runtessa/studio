import type { FormEventHandler } from 'react';
import { DataCard } from '@/components/ui/DataCard';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { type TeamTenantOption } from '@/lib/client/teams-admin';

type TeamTenantsCardProps = {
  busyAction: string;
  tenantIdToAssign: string;
  availableTenants: TeamTenantOption[];
  assignedTenants: TeamTenantOption[];
  onTenantSelect: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onRemove: (tenantId: string, hostname: string) => Promise<void>;
};

export function TeamTenantsCard({
  busyAction,
  tenantIdToAssign,
  availableTenants,
  assignedTenants,
  onTenantSelect,
  onSubmit,
  onRemove,
}: TeamTenantsCardProps) {
  return (
    <DataCard
      title="Team access"
      subtitle="Assign the tenant workspaces this team is allowed to operate on."
    >
      <div className="space-y-5">
        <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onSubmit}>
          <Select
            label="Tenant"
            value={tenantIdToAssign}
            onChange={(event) => onTenantSelect(String(event.target.value))}
          >
            <option value="">Select tenant</option>
            {availableTenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.hostname}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              disabled={Boolean(busyAction) || !tenantIdToAssign}
            >
              {busyAction === 'assign-tenant' ? 'Assigning...' : 'Assign Tenant'}
            </Button>
          </div>
        </form>

        <DataTable
          headers={['Tenant', 'Status', 'Registration', 'Actions']}
          emptyMessage="No tenants assigned to this team."
          size="sm"
        >
          {assignedTenants.map((tenant) => (
            <tr key={tenant.id} className="transition hover:bg-bgApp">
              <td className="px-3 py-2 text-textPrimary">{tenant.hostname}</td>
              <td className="px-3 py-2 text-textMuted">
                {tenant.isSuspended ? 'Suspended' : 'Active'}
              </td>
              <td className="px-3 py-2 text-textMuted">
                {tenant.allowRegistration ? 'Enabled' : 'Disabled'}
              </td>
              <td className="px-3 py-2">
                <Button
                  variant="danger"
                  size="xs"
                  disabled={Boolean(busyAction)}
                  onClick={() => void onRemove(tenant.id, tenant.hostname)}
                >
                  {busyAction === `unassign-tenant:${tenant.id}` ? 'Removing...' : 'Remove'}
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </DataCard>
  );
}

export default TeamTenantsCard;
