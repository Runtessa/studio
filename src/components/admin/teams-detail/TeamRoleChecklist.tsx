import { TEAM_ROLE_LABELS, TEAM_ROLE_ORDER, type TeamRole } from '@/lib/client/teams-admin';

type TeamRoleChecklistProps = {
  roles: TeamRole[];
  compact?: boolean;
  onToggle: (role: TeamRole) => void;
};

export function TeamRoleChecklist({ roles, compact = false, onToggle }: TeamRoleChecklistProps) {
  return (
    <div className={compact ? 'grid gap-1 sm:grid-cols-2' : 'grid gap-2 sm:grid-cols-2'}>
      {TEAM_ROLE_ORDER.map((role) => (
        <label
          key={role}
          className={`inline-flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-textPrimary`}
        >
          <input
            type="checkbox"
            checked={roles.includes(role)}
            onChange={() => onToggle(role)}
          />
          <span>{TEAM_ROLE_LABELS[role] || role}</span>
        </label>
      ))}
    </div>
  );
}

export default TeamRoleChecklist;
