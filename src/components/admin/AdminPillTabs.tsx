import Link from 'next/link';

export type AdminPillTabItem<T extends string> = {
  id: T;
  label: string;
  href?: string;
};

type AdminPillTabsProps<T extends string> = {
  activeTab: T;
  items: Array<AdminPillTabItem<T>>;
  onChange?: (tab: T) => void;
};

const baseTabClassName = (active: boolean) =>
  `rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
    active
      ? 'border-primary/50 bg-primaryDark text-textPrimary shadow-soft'
      : 'border-borderSubtle bg-bgApp/70 text-textMuted hover:bg-bgApp hover:text-textPrimary'
  }`;

export function AdminPillTabs<T extends string>({
  activeTab,
  items,
  onChange,
}: AdminPillTabsProps<T>) {
  return (
    <div className="rounded-2xl border border-borderSubtle bg-bgSurface/90 p-2">
      <nav className="flex flex-wrap gap-2">
        {items.map((tab) => {
          const active = tab.id === activeTab;
          if (onChange) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={baseTabClassName(active)}
              >
                {tab.label}
              </button>
            );
          }
          return tab.href ? (
            <Link key={tab.id} href={tab.href} className={baseTabClassName(active)}>
              {tab.label}
            </Link>
          ) : null;
        })}
      </nav>
    </div>
  );
}

export default AdminPillTabs;
