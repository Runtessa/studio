import { AdminSummaryCards } from '@/components/admin/AdminSummaryCards';

type TenantWorkspaceSummaryProps = {
  hostname: string;
  mode: 'create' | 'edit';
  isSuspended?: boolean;
  allowRegistration?: boolean;
  authDbMode?: 'shared' | 'dedicated';
  pwaEnabled?: boolean;
};

type SummaryItem = {
  label: string;
  value: string;
  hint: string;
};

export function TenantWorkspaceSummary({
  hostname,
  isSuspended = false,
  allowRegistration = true,
  authDbMode = 'shared',
  pwaEnabled = false,
}: TenantWorkspaceSummaryProps) {
  const items: SummaryItem[] = [
    {
      label: 'State',
      value: isSuspended ? 'Suspended' : 'Active',
      hint: isSuspended ? 'Traffic and operations are paused' : 'Tenant is available for normal traffic',
    },
    {
      label: 'Registration',
      value: allowRegistration ? 'Open' : 'Restricted',
      hint: allowRegistration ? 'New accounts can self-register' : 'Registration requires controlled onboarding',
    },
    {
      label: 'Auth DB',
      value: authDbMode === 'dedicated' ? 'Dedicated secret' : 'Shared global',
      hint: authDbMode === 'dedicated' ? 'Tenant uses isolated auth storage refs' : 'Tenant uses the shared auth database',
    },
    {
      label: 'PWA',
      value: pwaEnabled ? 'Enabled' : 'Disabled',
      hint: pwaEnabled ? 'Installable application shell is active' : 'Standard browser shell only',
    },
  ];

  return <AdminSummaryCards cards={items} />;
}

export default TenantWorkspaceSummary;
