import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAdminGuard } from '@/lib/client/use-admin-guard';
import {
  addTeamMember,
  assignTeamTenant,
  deleteTeam,
  fetchTeamDetail,
  fetchTeamTenants,
  fetchTeamUsers,
  removeTeamMember,
  unassignTeamTenant,
  updateTeam,
  updateTeamMemberRole,
  type TeamDetailPayload,
  type TeamRole,
  type TeamTenantOption,
  type TeamUserOption,
} from '@/lib/client/teams-admin';
import {
  buildTeamSummaryCards,
  getRoleSequenceError,
  parseTeamId,
  toRoleList,
  toggleRole,
} from './teamDetailModel';
import type { TeamDetailTabId } from './TeamDetailTabs';

export function useTeamDetailPage() {
  const router = useRouter();
  const teamId = parseTeamId(router.query.id);
  const queryTabRaw = router.query.tab;
  const queryTab = Array.isArray(queryTabRaw) ? queryTabRaw[0] : queryTabRaw;
  const { token, ready, isAdmin, loading: authLoading, error: authError } = useAdminGuard('ide.users.manage');

  const [teamDetail, setTeamDetail] = useState<TeamDetailPayload | null>(null);
  const [users, setUsers] = useState<TeamUserOption[]>([]);
  const [tenants, setTenants] = useState<TeamTenantOption[]>([]);
  const [tenantIdToAssign, setTenantIdToAssign] = useState('');
  const [memberRoleDraft, setMemberRoleDraft] = useState<Record<number, TeamRole[]>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<TeamDetailTabId>('settings');
  const [editForm, setEditForm] = useState({
    name: '',
    key: '',
    description: '',
    isActive: true,
  });
  const [memberForm, setMemberForm] = useState({
    userId: '',
    roles: ['observer'] as TeamRole[],
  });

  const loadUsers = async () => {
    if (!token) return;
    try {
      const rows = await fetchTeamUsers(token);
      setUsers(rows.sort((a: TeamUserOption, b: TeamUserOption) => a.email.localeCompare(b.email)));
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    }
  };

  const loadTeamDetail = async (options?: { silent?: boolean }) => {
    if (!token || !teamId) return;
    if (!options?.silent) {
      setDetailLoading(true);
      setError('');
    }
    try {
      const detail = await fetchTeamDetail(token, teamId);
      setTeamDetail(detail);
      setEditForm({
        name: detail.team.name || '',
        key: detail.team.key || '',
        description: detail.team.description || '',
        isActive: Boolean(detail.team.isActive),
      });
      const drafts: Record<number, TeamRole[]> = {};
      detail.members.forEach((member) => {
        drafts[member.id] = toRoleList(member.teamRoles ?? member.teamRole);
      });
      setMemberRoleDraft(drafts);
    } catch (err: any) {
      setError(err.message || 'Failed to load team details');
      setTeamDetail(null);
    } finally {
      if (!options?.silent) setDetailLoading(false);
    }
  };

  const loadTeamTenants = async () => {
    if (!token || !teamId) return;
    try {
      const data = await fetchTeamTenants(token, teamId);
      const rows = Array.isArray(data?.tenants) ? data.tenants : [];
      setTenants(rows);
      const firstAvailable = rows.find((entry) => !entry.assigned);
      const stillAvailable = rows.some((entry) => !entry.assigned && entry.id === tenantIdToAssign);
      if (stillAvailable) return;
      setTenantIdToAssign(firstAvailable?.id || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load tenant assignments');
    }
  };

  useEffect(() => {
    setActiveTab(
      queryTab === 'members' || queryTab === 'access'
        ? queryTab
        : 'settings'
    );
  }, [queryTab]);

  useEffect(() => {
    if (!ready || !token || !isAdmin || !teamId) return;
    void Promise.all([loadTeamDetail(), loadUsers(), loadTeamTenants()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token, isAdmin, teamId]);

  const selectedMemberIds = useMemo(
    () => new Set((teamDetail?.members || []).map((member) => member.userId)),
    [teamDetail?.members]
  );
  const availableUsers = useMemo(
    () => users.filter((entry) => !selectedMemberIds.has(entry.id)),
    [users, selectedMemberIds]
  );
  const assignedTenants = useMemo(() => tenants.filter((entry) => entry.assigned), [tenants]);
  const availableTenants = useMemo(() => tenants.filter((entry) => !entry.assigned), [tenants]);
  const memberFormRoleError = useMemo(() => getRoleSequenceError(memberForm.roles), [memberForm.roles]);
  const summaryCards = useMemo(
    () => buildTeamSummaryCards(teamDetail, assignedTenants.length),
    [assignedTenants.length, teamDetail]
  );

  const handleSaveTeam = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !teamId) return;
    if (!editForm.name.trim()) {
      setError('Team name is required');
      return;
    }
    setBusyAction('save-team');
    setError('');
    setSuccess('');
    try {
      const result = await updateTeam(token, teamId, {
        name: editForm.name.trim(),
        key: editForm.key.trim(),
        description: editForm.description.trim() || null,
        isActive: editForm.isActive,
      });
      setSuccess(`Team "${result.team.name}" updated`);
      await loadTeamDetail({ silent: true });
    } catch (err: any) {
      setError(err.message || 'Failed to update team');
    } finally {
      setBusyAction('');
    }
  };

  const handleDeleteTeam = async () => {
    if (!token || !teamId || !teamDetail?.team) return;
    if (!window.confirm(`Delete team "${teamDetail.team.name}"? This removes all memberships.`)) return;
    setBusyAction('delete-team');
    setError('');
    setSuccess('');
    try {
      await deleteTeam(token, teamId);
      router.push('/admin/teams');
    } catch (err: any) {
      setError(err.message || 'Failed to delete team');
    } finally {
      setBusyAction('');
    }
  };

  const handleAddMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !teamId) return;
    const userId = Number(memberForm.userId);
    if (!Number.isInteger(userId) || userId <= 0) return setError('Select a user to add');
    const roles = toRoleList(memberForm.roles);
    const roleError = getRoleSequenceError(roles);
    if (roleError) return setError(roleError);
    setBusyAction('add-member');
    setError('');
    setSuccess('');
    try {
      await addTeamMember(token, teamId, { userId, roles });
      setSuccess('Member added to team');
      setMemberForm({ userId: '', roles: ['observer'] });
      await loadTeamDetail({ silent: true });
    } catch (err: any) {
      setError(err.message || 'Failed to add member');
    } finally {
      setBusyAction('');
    }
  };

  const handleSetMemberRole = async (memberId: number, rolesInput: TeamRole[]) => {
    if (!token || !teamId) return;
    const roles = toRoleList(rolesInput);
    const roleError = getRoleSequenceError(roles);
    if (roleError) {
      setError(roleError);
      throw new Error(roleError);
    }
    setBusyAction(`member-role:${memberId}`);
    setError('');
    setSuccess('');
    try {
      await updateTeamMemberRole(token, teamId, memberId, { roles });
      setSuccess('Team roles updated');
      await loadTeamDetail({ silent: true });
    } catch (err: any) {
      setError(err.message || 'Failed to update team roles');
      throw err;
    } finally {
      setBusyAction('');
    }
  };

  const handleToggleMemberRoleDraft = (memberId: number, role: TeamRole) => {
    setMemberRoleDraft((prev) => ({
      ...prev,
      [memberId]: toggleRole(toRoleList(prev[memberId] || ['observer']), role),
    }));
  };

  const handleToggleAddMemberRole = (role: TeamRole) => {
    setMemberForm((prev) => ({
      ...prev,
      roles: toggleRole(toRoleList(prev.roles), role),
    }));
  };

  const handleRemoveMember = async (memberId: number, email?: string | null) => {
    if (!token || !teamId) return;
    if (!window.confirm(`Remove ${email || 'this user'} from team?`)) return;
    setBusyAction(`member-remove:${memberId}`);
    setError('');
    setSuccess('');
    try {
      await removeTeamMember(token, teamId, memberId);
      setSuccess('Member removed');
      await loadTeamDetail({ silent: true });
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setBusyAction('');
    }
  };

  const handleAssignTenant = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !teamId || !tenantIdToAssign) return;
    setBusyAction('assign-tenant');
    setError('');
    setSuccess('');
    try {
      await assignTeamTenant(token, teamId, tenantIdToAssign);
      setSuccess('Tenant assigned to team');
      await loadTeamTenants();
    } catch (err: any) {
      setError(err.message || 'Failed to assign tenant');
    } finally {
      setBusyAction('');
    }
  };

  const handleUnassignTenant = async (tenantIdToRemove: string, hostname: string) => {
    if (!token || !teamId) return;
    if (!window.confirm(`Remove tenant "${hostname}" from this team?`)) return;
    setBusyAction(`unassign-tenant:${tenantIdToRemove}`);
    setError('');
    setSuccess('');
    try {
      await unassignTeamTenant(token, teamId, tenantIdToRemove);
      setSuccess('Tenant removed from team');
      await loadTeamTenants();
    } catch (err: any) {
      setError(err.message || 'Failed to remove tenant');
    } finally {
      setBusyAction('');
    }
  };

  const handleTabChange = (tab: TeamDetailTabId) => {
    setActiveTab(tab);
    if (!teamId) return;
    void router.replace(
      {
        pathname: `/admin/teams/${teamId}`,
        query: tab === 'settings' ? {} : { tab },
      },
      undefined,
      { shallow: true }
    );
  };

  return {
    teamId,
    ready,
    isAdmin,
    authLoading,
    authError,
    teamDetail,
    detailLoading,
    busyAction,
    error,
    success,
    activeTab,
    editForm,
    memberForm,
    memberRoleDraft,
    tenantIdToAssign,
    availableUsers,
    availableTenants,
    assignedTenants,
    memberFormRoleError,
    summaryCards,
    setEditForm,
    setMemberForm,
    setTenantIdToAssign,
    loadTeamDetail,
    handleTabChange,
    handleSaveTeam,
    handleDeleteTeam,
    handleAddMember,
    handleSetMemberRole,
    handleToggleMemberRoleDraft,
    handleToggleAddMemberRole,
    handleRemoveMember,
    handleAssignTenant,
    handleUnassignTenant,
  };
}

export default useTeamDetailPage;
