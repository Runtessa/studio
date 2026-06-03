import { AdminPillTabs } from '@/components/admin/AdminPillTabs';

export type TeamDetailTabId = 'settings' | 'members' | 'access';

type TeamDetailTabsProps = {
  activeTab: TeamDetailTabId;
  onChange: (tab: TeamDetailTabId) => void;
};

const TABS: Array<{ id: TeamDetailTabId; label: string }> = [
  { id: 'settings', label: 'Team settings' },
  { id: 'members', label: 'Team members' },
  { id: 'access', label: 'Team access' },
];

export function TeamDetailTabs({ activeTab, onChange }: TeamDetailTabsProps) {
  return <AdminPillTabs activeTab={activeTab} items={TABS} onChange={onChange} />;
}

export default TeamDetailTabs;
