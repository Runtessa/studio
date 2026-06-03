import { TEAM_ROLE_LABELS, TEAM_ROLE_ORDER, type TeamRole } from '@/lib/client/teams-admin';

type TeamRoleSwitchListProps = {
  roles: TeamRole[];
  compact?: boolean;
  onToggle: (role: TeamRole) => void;
};

export function TeamRoleSwitchList({ roles, compact = false, onToggle }: TeamRoleSwitchListProps) {
  return (
    <div className={compact ? 'grid gap-1.5 sm:grid-cols-2' : 'grid gap-2 sm:grid-cols-2'}>
      {TEAM_ROLE_ORDER.map((role) => {
        const checked = roles.includes(role);
        return (
          <label
            key={role}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
              checked
                ? 'border-primary/50 bg-primaryDark/50 text-textPrimary'
                : 'border-borderSubtle bg-bgApp text-textMuted'
            }`}
          >
            <span className={compact ? 'text-xs' : 'text-sm'}>{TEAM_ROLE_LABELS[role] || role}</span>
            <button
              type="button"
              onClick={() => onToggle(role)}
              className={`relative h-5 w-9 rounded-full transition ${
                checked ? 'bg-textPrimary' : 'bg-borderSubtle'
              }`}
              aria-pressed={checked}
              aria-label={`Toggle ${TEAM_ROLE_LABELS[role] || role}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-bgApp transition ${
                  checked ? 'left-4' : 'left-0.5'
                }`}
              />
            </button>
          </label>
        );
      })}
    </div>
  );
}

export default TeamRoleSwitchList;
