import { PageHeader } from '@/components/layout/PageHeader';
import { DataCard } from '@/components/ui/DataCard';
import { Button } from '@/components/ui/Button';
import { TeamDetailSummary } from '@/components/admin/teams-detail/TeamDetailSummary';
import { TeamDetailTabs } from '@/components/admin/teams-detail/TeamDetailTabs';
import { TeamMembersCard } from '@/components/admin/teams-detail/TeamMembersCard';
import { TeamSettingsCard } from '@/components/admin/teams-detail/TeamSettingsCard';
import { TeamTenantsCard } from '@/components/admin/teams-detail/TeamTenantsCard';
import { formatDate } from '@/components/admin/teams-detail/teamDetailModel';
import { useTeamDetailPage } from '@/components/admin/teams-detail/useTeamDetailPage';

export default function AdminTeamDetailPage() {
  const {
    teamId,
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
  } = useTeamDetailPage();

  return (
    <div className="space-y-6">
      <PageHeader
        title={teamDetail?.team?.name || 'Team Details'}
        subtitle="Manage team profile, memberships, and tenant access boundaries."
        actions={
          <Button href="/admin/teams" variant="secondary" size="sm">
            Back to teams
          </Button>
        }
      />

      {authLoading || detailLoading ? <DataCard title="Loading team" subtitle="Please wait..." /> : null}
      {authError ? (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">{authError}</div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-borderSubtle bg-bgSurface px-4 py-3 text-sm text-textPrimary">
          {success}
        </div>
      ) : null}

      {!teamId ? (
        <DataCard title="Invalid team id" subtitle="Open a valid team from the teams directory." />
      ) : null}

      {teamDetail ? (
        <>
          <TeamDetailSummary cards={summaryCards} />
          <TeamDetailTabs activeTab={activeTab} onChange={handleTabChange} />

          {activeTab === 'settings' ? (
            <TeamSettingsCard
              value={editForm}
              createdAt={formatDate(teamDetail.team.createdAt)}
              busyAction={busyAction}
              onChange={(next) => setEditForm((current) => ({ ...current, ...next }))}
              onSubmit={handleSaveTeam}
              onDelete={handleDeleteTeam}
            />
          ) : activeTab === 'members' ? (
            <TeamMembersCard
              loading={detailLoading}
              busyAction={busyAction}
              members={teamDetail.members}
              availableUsers={availableUsers}
              memberRoleDraft={memberRoleDraft}
              memberForm={memberForm}
              memberFormRoleError={memberFormRoleError}
              onMemberFormChange={(next) => setMemberForm((current) => ({ ...current, ...next }))}
              onToggleAddMemberRole={handleToggleAddMemberRole}
              onSubmit={handleAddMember}
              onToggleMemberRoleDraft={handleToggleMemberRoleDraft}
              onApplyMemberRoles={handleSetMemberRole}
              onRemoveMember={handleRemoveMember}
            />
          ) : (
            <TeamTenantsCard
              busyAction={busyAction}
              tenantIdToAssign={tenantIdToAssign}
              availableTenants={availableTenants}
              assignedTenants={assignedTenants}
              onTenantSelect={setTenantIdToAssign}
              onSubmit={handleAssignTenant}
              onRemove={handleUnassignTenant}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
