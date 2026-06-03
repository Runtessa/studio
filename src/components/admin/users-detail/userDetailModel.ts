import {
  IDE_ROLE_DESCRIPTIONS,
  IDE_ROLE_LABELS,
  getRolePermissions,
  normalizeIdeRole,
  type IdeRole,
} from '@/lib/rbac';

export type UserListItem = {
  email: string;
  role: string;
  token: string;
  createdAt?: string;
};

export const buildUserSummaryCards = (user: UserListItem | null) => {
  if (!user) return [];
  const role = normalizeIdeRole(user.role);
  return [
    {
      label: 'Role',
      value: IDE_ROLE_LABELS[role] || user.role,
      hint: IDE_ROLE_DESCRIPTIONS[role] || 'IDE access role',
    },
    {
      label: 'Account',
      value: 'Managed user',
      hint: user.email,
    },
    {
      label: 'Token',
      value: user.token ? 'Configured' : 'Missing',
      hint: user.token ? 'API token is present for scripted access' : 'No API token assigned',
    },
    {
      label: 'Created',
      value: formatDate(user.createdAt),
      hint: 'Original provisioning time',
    },
  ];
};

export const buildRoleAccessItems = (roleInput: string) => {
  const role = normalizeIdeRole(roleInput);
  return {
    role,
    label: IDE_ROLE_LABELS[role] || roleInput,
    description: IDE_ROLE_DESCRIPTIONS[role] || 'IDE access role',
    permissions: getRolePermissions(roleInput),
  };
};

export const formatDate = (value?: string) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export const roleOption = (role: string) => ({
  value: role,
  label: IDE_ROLE_LABELS[role as IdeRole] || role,
});
