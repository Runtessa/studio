import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IDE_ROLE_LABELS } from '@/lib/rbac';
import {
  TEAM_ROLE_LABELS,
  type TeamDetailPayload,
  type TeamRole,
} from '@/lib/client/teams-admin';
import { toRoleList } from './teamDetailModel';
import { TeamMembersTable } from './TeamMembersTable';

type TeamMembersDirectoryProps = {
  loading: boolean;
  busyAction: string;
  members: TeamDetailPayload['members'];
  memberRoleDraft: Record<number, TeamRole[]>;
  onToggleMemberRoleDraft: (memberId: number, role: TeamRole) => void;
  onApplyMemberRoles: (memberId: number, roles: TeamRole[]) => Promise<void>;
  onRemoveMember: (memberId: number, email?: string | null) => Promise<void>;
};

const PAGE_SIZE = 10;

export function TeamMembersDirectory({
  loading,
  busyAction,
  members,
  memberRoleDraft,
  onToggleMemberRoleDraft,
  onApplyMemberRoles,
  onRemoveMember,
}: TeamMembersDirectoryProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const roles = toRoleList(memberRoleDraft[member.id] ?? member.teamRoles ?? member.teamRole);
      const haystack = [
        member.userEmail || '',
        String(member.userId),
        member.userRole ? IDE_ROLE_LABELS[member.userRole as keyof typeof IDE_ROLE_LABELS] || member.userRole : '',
        ...roles.map((role) => TEAM_ROLE_LABELS[role] || role),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [memberRoleDraft, members, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedMembers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredMembers.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredMembers]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (!members.length) {
      setSelectedMemberId(null);
      return;
    }
    if (selectedMemberId === null) return;
    if (!members.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(null);
    }
  }, [members, selectedMemberId]);

  useEffect(() => {
    if (selectedMemberId === null) return;
    if (!filteredMembers.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(null);
    }
  }, [filteredMembers, selectedMemberId]);

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgSurface p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-textPrimary">Members directory</h3>
            <p className="text-xs text-textMuted">
              Search, review, and select members for role changes without turning the table into the editor.
            </p>
          </div>
          <div className="w-full max-w-sm">
            <Input
              label="Search members"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search email, role, or user id"
            />
          </div>
        </div>

        <TeamMembersTable
          loading={loading}
          busyAction={busyAction}
          members={pagedMembers}
          memberRoleDraft={memberRoleDraft}
          selectedMemberId={selectedMemberId}
          onSelectMember={setSelectedMemberId}
          onCancelEdit={() => setSelectedMemberId(null)}
          onToggleMemberRoleDraft={onToggleMemberRoleDraft}
          onApplyMemberRoles={onApplyMemberRoles}
          onRemoveMember={onRemoveMember}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-textMuted">
            Showing {(currentPage - 1) * PAGE_SIZE + (pagedMembers.length ? 1 : 0)}-
            {(currentPage - 1) * PAGE_SIZE + pagedMembers.length} of {filteredMembers.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              disabled={currentPage <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-textMuted">
              Page {currentPage} / {pageCount}
            </span>
            <Button
              variant="secondary"
              size="xs"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default TeamMembersDirectory;
