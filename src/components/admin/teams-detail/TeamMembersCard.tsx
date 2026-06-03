import type { FormEventHandler } from 'react';
import { DataCard } from '@/components/ui/DataCard';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { IDE_ROLE_LABELS } from '@/lib/rbac';
import {
  type TeamDetailPayload,
  type TeamRole,
  type TeamUserOption,
} from '@/lib/client/teams-admin';
import { TeamRoleChecklist } from './TeamRoleChecklist';
import { TeamMembersDirectory } from './TeamMembersDirectory';

type TeamMembersCardProps = {
  loading: boolean;
  busyAction: string;
  members: TeamDetailPayload['members'];
  availableUsers: TeamUserOption[];
  memberRoleDraft: Record<number, TeamRole[]>;
  memberForm: {
    userId: string;
    roles: TeamRole[];
  };
  memberFormRoleError: string;
  onMemberFormChange: (next: Partial<TeamMembersCardProps['memberForm']>) => void;
  onToggleAddMemberRole: (role: TeamRole) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onToggleMemberRoleDraft: (memberId: number, role: TeamRole) => void;
  onApplyMemberRoles: (memberId: number, roles: TeamRole[]) => Promise<void>;
  onRemoveMember: (memberId: number, email?: string | null) => Promise<void>;
};

export function TeamMembersCard({
  loading,
  busyAction,
  members,
  availableUsers,
  memberRoleDraft,
  memberForm,
  memberFormRoleError,
  onMemberFormChange,
  onToggleAddMemberRole,
  onSubmit,
  onToggleMemberRoleDraft,
  onApplyMemberRoles,
  onRemoveMember,
}: TeamMembersCardProps) {
  return (
    <DataCard
      title="Team members"
      subtitle="Add people, define team-scoped capabilities, and enforce the role dependency chain."
    >
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <form className="space-y-5" onSubmit={onSubmit}>
          <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgApp p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-textPrimary">Add member</h3>
              <p className="text-xs text-textMuted">
                Pick an existing IDE user and assign the minimum team roles required for their work.
              </p>
            </div>
            <Select
              label="User"
              value={memberForm.userId}
              onChange={(event) => onMemberFormChange({ userId: String(event.target.value) })}
            >
              <option value="">Select user</option>
              {availableUsers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.email} ({IDE_ROLE_LABELS[entry.role as keyof typeof IDE_ROLE_LABELS] || entry.role})
                </option>
              ))}
            </Select>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-textPrimary">Initial team roles</h3>
              <p className="text-xs text-textMuted">
                Start with the minimum access needed. Higher roles require the lower prerequisite roles.
              </p>
            </div>
            <TeamRoleChecklist roles={memberForm.roles} onToggle={onToggleAddMemberRole} />
            {memberFormRoleError ? <p className="text-xs text-danger">{memberFormRoleError}</p> : null}
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={Boolean(busyAction) || Boolean(memberFormRoleError)}
              >
                {busyAction === 'add-member' ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </section>
        </form>

        <TeamMembersDirectory
          loading={loading}
          busyAction={busyAction}
          members={members}
          memberRoleDraft={memberRoleDraft}
          onToggleMemberRoleDraft={onToggleMemberRoleDraft}
          onApplyMemberRoles={onApplyMemberRoles}
          onRemoveMember={onRemoveMember}
        />
      </div>
    </DataCard>
  );
}

export default TeamMembersCard;
