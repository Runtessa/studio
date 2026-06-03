import { AdminPillTabs } from '@/components/admin/AdminPillTabs';

export type UserDetailTabId = 'settings' | 'security' | 'access';

type UserDetailTabsProps = {
  activeTab: UserDetailTabId;
  onChange: (tab: UserDetailTabId) => void;
};

const TABS: Array<{ id: UserDetailTabId; label: string }> = [
  { id: 'settings', label: 'User settings' },
  { id: 'security', label: 'Security' },
  { id: 'access', label: 'Access profile' },
];

export function UserDetailTabs({ activeTab, onChange }: UserDetailTabsProps) {
  return <AdminPillTabs activeTab={activeTab} items={TABS} onChange={onChange} />;
}

export default UserDetailTabs;
