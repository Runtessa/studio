type TenantSettingsTabId = 'tenant' | 'branding' | 'pwa' | 'adapters';

type TenantSettingsTabsProps = {
  activeTab: TenantSettingsTabId;
  onChange: (tab: TenantSettingsTabId) => void;
};

const TABS: Array<{ id: TenantSettingsTabId; label: string }> = [
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

export function TenantSettingsTabs({ activeTab, onChange }: TenantSettingsTabsProps) {
  return (
    <div className="rounded-xl border border-borderSubtle bg-bgSurface p-2">
      <nav className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? 'border-primary bg-primaryDark text-textPrimary'
                  : 'border-borderSubtle text-textMuted hover:bg-bgApp hover:text-textPrimary'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default TenantSettingsTabs;
