import { Fragment } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { IDE_ROLE_LABELS } from '@/lib/rbac';
import {
  TEAM_ROLE_LABELS,
  type TeamDetailPayload,
  type TeamRole,
} from '@/lib/client/teams-admin';
import { formatDate, getRoleSequenceError, toRoleList } from './teamDetailModel';
import { TeamRoleSwitchList } from './TeamRoleSwitchList';

type TeamMembersTableProps = {
  loading: boolean;
  busyAction: string;
  members: TeamDetailPayload['members'];
  memberRoleDraft: Record<number, TeamRole[]>;
  selectedMemberId: number | null;
  onSelectMember: (memberId: number) => void;
  onCancelEdit: () => void;
  onToggleMemberRoleDraft: (memberId: number, role: TeamRole) => void;
  onApplyMemberRoles: (memberId: number, roles: TeamRole[]) => Promise<void>;
  onRemoveMember: (memberId: number, email?: string | null) => Promise<void>;
};

export function TeamMembersTable({
  loading,
  busyAction,
  members,
  memberRoleDraft,
  selectedMemberId,
  onSelectMember,
  onCancelEdit,
  onToggleMemberRoleDraft,
  onApplyMemberRoles,
  onRemoveMember,
}: TeamMembersTableProps) {
  return (
    <DataTable
      headers={['User', 'Global Role', 'Team Roles', 'Joined', 'Actions']}
      loading={loading}
      emptyMessage="No members match the current filter."
      size="sm"
    >
      {members.map((member) => {
        const currentRoles = toRoleList(memberRoleDraft[member.id] ?? member.teamRoles ?? member.teamRole);
        const isSelected = selectedMemberId === member.id;
        const roleError = getRoleSequenceError(currentRoles);
        return (
          <Fragment key={member.id}>
            <tr className={`transition hover:bg-bgApp ${isSelected ? 'bg-bgApp/80' : ''}`}>
              <td className="px-3 py-2">
                <div className="font-medium text-textPrimary">{member.userEmail || `#${member.userId}`}</div>
                <div className="text-xs text-textMuted">user id: {member.userId}</div>
              </td>
              <td className="px-3 py-2 text-textMuted">
                {member.userRole
                  ? IDE_ROLE_LABELS[member.userRole as keyof typeof IDE_ROLE_LABELS] || member.userRole
                  : '-'}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {currentRoles.map((role) => (
                    <span
                      key={`${member.id}:${role}`}
                      className="rounded-full border border-borderSubtle bg-bgSurface px-2 py-0.5 text-[11px] text-textPrimary"
                    >
                      {TEAM_ROLE_LABELS[role] || role}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2 text-xs text-textMuted">{formatDate(member.createdAt)}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={isSelected ? 'primary' : 'secondary'}
                    size="xs"
                    disabled={Boolean(busyAction)}
                    onClick={() => onSelectMember(member.id)}
                  >
                    {isSelected ? 'Editing' : 'Edit roles'}
                  </Button>
                  <Button
                    variant="danger"
                    size="xs"
                    disabled={Boolean(busyAction)}
                    onClick={() => void onRemoveMember(member.id, member.userEmail)}
                  >
                    {busyAction === `member-remove:${member.id}` ? 'Removing...' : 'Remove'}
                  </Button>
                </div>
              </td>
            </tr>
            {isSelected ? (
              <tr className="bg-bgApp/60">
                <td colSpan={5} className="px-3 py-3">
                  <div className="rounded-xl border border-borderSubtle bg-bgSurface p-4">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-textPrimary">Edit team roles</div>
                        <div className="text-xs text-textMuted">
                          {member.userEmail || `#${member.userId}`} · switch roles, then save.
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          size="xs"
                          disabled={Boolean(busyAction) || Boolean(roleError)}
                          onClick={async () => {
                            try {
                              await onApplyMemberRoles(member.id, currentRoles);
                              onCancelEdit();
                            } catch {
                              // Parent handler already surfaces the failure state.
                            }
                          }}
                        >
                          {busyAction === `member-role:${member.id}` ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="xs"
                          disabled={Boolean(busyAction)}
                          onClick={onCancelEdit}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                    <TeamRoleSwitchList
                      roles={currentRoles}
                      onToggle={(role) => onToggleMemberRoleDraft(member.id, role)}
                    />
                    {roleError ? <p className="mt-3 text-xs text-danger">{roleError}</p> : null}
                  </div>
                </td>
              </tr>
            ) : null}
          </Fragment>
        );
      })}
    </DataTable>
  );
}

export default TeamMembersTable;
