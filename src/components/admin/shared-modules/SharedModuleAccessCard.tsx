import { DataCard } from '@/components/ui/DataCard';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { TeamOption } from './model';

type SharedModuleAccessCardProps = {
  teamOptions: TeamOption[];
  ownerTeamId: number | '';
  editorTeamIds: number[];
  canManageAccess: boolean;
  canChangeOwner: boolean;
  savingAccess: boolean;
  onOwnerChange: (value: number | '') => void;
  onToggleEditorTeam: (teamId: number, checked: boolean) => void;
  onSave: () => void;
};

export function SharedModuleAccessCard({
  teamOptions,
  ownerTeamId,
  editorTeamIds,
  canManageAccess,
  canChangeOwner,
  savingAccess,
  onOwnerChange,
  onToggleEditorTeam,
  onSave,
}: SharedModuleAccessCardProps) {
  return (
    <DataCard
      title="Team access"
      subtitle="Owner team controls publish authority. Additional teams can be granted edit access."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgApp p-5">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-textPrimary">Ownership</h3>
            <p className="text-xs text-textMuted">
              The owner team is the primary governance boundary for this backend package.
            </p>
          </div>
          <Select
            label="Owner team"
            value={ownerTeamId === '' ? '' : String(ownerTeamId)}
            options={[
              { label: 'Unassigned', value: '' },
              ...teamOptions.map((team) => ({
                label: `${team.name} (${team.key})`,
                value: String(team.id),
              })),
            ]}
            disabled={!canManageAccess || !canChangeOwner}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onOwnerChange(Number.isInteger(parsed) && parsed > 0 ? parsed : '');
            }}
          />
          {!canManageAccess ? (
            <p className="text-xs text-textMuted">
              Access management is restricted to owner-team tenant admins or platform admins.
            </p>
          ) : null}
        </section>

        <section className="space-y-4 rounded-2xl border border-borderSubtle bg-bgSurface p-5">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-textPrimary">Editor teams</h3>
            <p className="text-xs text-textMuted">
              Grant write access to teams that should maintain this shared backend without taking ownership.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {teamOptions.length === 0 ? (
              <div className="text-sm text-textMuted">No active teams available.</div>
            ) : (
              teamOptions.map((team) => {
                const isOwner = ownerTeamId !== '' && Number(ownerTeamId) === team.id;
                const checked = isOwner || editorTeamIds.includes(team.id);
                return (
                  <label
                    key={team.id}
                    className="flex items-center gap-2 rounded-xl border border-borderSubtle bg-bgApp px-3 py-2 text-sm text-textPrimary"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canManageAccess || isOwner}
                      onChange={(event) => onToggleEditorTeam(team.id, event.target.checked)}
                    />
                    <span>{team.name}</span>
                    <span className="text-xs text-textMuted">({team.key})</span>
                  </label>
                );
              })
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onSave} disabled={!canManageAccess || savingAccess}>
              {savingAccess ? 'Saving…' : 'Save access'}
            </Button>
          </div>
        </section>
      </div>
    </DataCard>
  );
}

export default SharedModuleAccessCard;
