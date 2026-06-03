import { getMissingRoleDependencies, normalizeTeamMemberRoles } from '@/lib/team-roles';
import {
  TEAM_ROLE_LABELS,
  TEAM_ROLE_ORDER,
  type TeamDetailPayload,
  type TeamRole,
} from '@/lib/client/teams-admin';

export const toRoleList = (value: unknown): TeamRole[] => {
  const normalized = normalizeTeamMemberRoles(value);
  return TEAM_ROLE_ORDER.filter((role) => normalized.includes(role)) as TeamRole[];
};

export const toggleRole = (rolesInput: TeamRole[], role: TeamRole): TeamRole[] => {
  const current = toRoleList(rolesInput);
  let next: TeamRole[];
  if (role === 'observer') {
    next = current.includes('observer') ? [] : ['observer'];
  } else if (current.includes(role)) {
    next = current.filter((entry) => entry !== role);
  } else {
    next = [...current.filter((entry) => entry !== 'observer'), role];
  }
  const normalized = toRoleList(next);
  return normalized.length ? normalized : ['observer'];
};

export const getRoleSequenceError = (rolesInput: TeamRole[]) => {
  const missing = getMissingRoleDependencies(rolesInput) as TeamRole[];
  if (!missing.length) return '';
  return `Missing prerequisite role(s): ${missing
    .map((role) => TEAM_ROLE_LABELS[role] || role)
    .join(', ')}`;
};

export const parseTeamId = (raw: unknown): number | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const formatDate = (value?: string) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export const buildTeamSummaryCards = (
  teamDetail: TeamDetailPayload | null,
  assignedTenantCount: number
) => {
  if (!teamDetail) return [];
  return [
    {
      label: 'State',
      value: teamDetail.team.isActive ? 'Active' : 'Inactive',
      hint: teamDetail.team.isActive ? 'Accepting assignments' : 'Held for archival or paused ownership',
    },
    {
      label: 'Members',
      value: String(teamDetail.members.length),
      hint: 'Current team memberships',
    },
    {
      label: 'Tenants',
      value: String(assignedTenantCount),
      hint: 'Assigned tenant workspaces',
    },
    {
      label: 'Created',
      value: formatDate(teamDetail.team.createdAt),
      hint: 'Original provisioning time',
    },
  ];
};
