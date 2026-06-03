import { AdminPillTabs, type AdminPillTabItem } from '@/components/admin/AdminPillTabs';

export type TenantSettingsTabId = 'tenant' | 'branding' | 'pwa' | 'adapters' | 'secrets';

type TenantSettingsTabsProps = {
  activeTab: TenantSettingsTabId;
  onChange?: (tab: TenantSettingsTabId) => void;
  tenantId?: string;
};

const TABS: Array<{ id: Exclude<TenantSettingsTabId, 'secrets'>; label: string }> = [
  {
    id: 'tenant',
    label: 'Tenant configuration',
  },
  {
    id: 'branding',
    label: 'Branding',
  },
  {
    id: 'pwa',
    label: 'PWA',
  },
  {
    id: 'adapters',
    label: 'Adapter configuration',
  },
];

export function TenantSettingsTabs({ activeTab, onChange, tenantId }: TenantSettingsTabsProps) {
  const items: AdminPillTabItem<TenantSettingsTabId>[] = TABS.map((tab) => ({
    ...tab,
    href: tenantId ? `/admin/tenants/${tenantId}?tab=${tab.id}` : undefined,
  }));

  if (tenantId) {
    items.push({
      id: 'secrets',
      label: 'Manage secrets',
      href: `/admin/tenants/${tenantId}?tab=secrets`,
    });
  }

  return <AdminPillTabs activeTab={activeTab} items={items} onChange={onChange} />;
}

export default TenantSettingsTabs;
