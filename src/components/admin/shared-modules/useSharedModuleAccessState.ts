import { useState } from 'react';
import { fetchSharedModuleAccess, saveSharedModuleAccess } from './editorApi';
import type { TeamOption } from './model';

type UseSharedModuleAccessStateInput = {
  token: string | undefined;
  projectId: string | undefined;
  success: (message: string) => void;
  showError: (message: string) => void;
};

export function useSharedModuleAccessState({
  token,
  projectId,
  success,
  showError,
}: UseSharedModuleAccessStateInput) {
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [ownerTeamId, setOwnerTeamId] = useState<number | ''>('');
  const [editorTeamIds, setEditorTeamIds] = useState<number[]>([]);
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [canChangeOwner, setCanChangeOwner] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);

  const loadAccess = async (activeToken: string, activeProjectId: string) => {
    const payload = await fetchSharedModuleAccess(activeToken, activeProjectId);
    const access = payload?.access ?? {};
    const teams = Array.isArray(payload?.teams) ? payload.teams : [];
    setTeamOptions(teams);
    setOwnerTeamId(Number.isInteger(access.ownerTeamId) ? access.ownerTeamId : '');
    setEditorTeamIds(
      Array.isArray(access.editorTeamIds)
        ? access.editorTeamIds.filter((entry: unknown) => Number.isInteger(Number(entry))).map(Number)
        : []
    );
    setCanManageAccess(Boolean(access.canManage));
    setCanChangeOwner(Boolean(access.canChangeOwner));
  };

  const toggleEditorTeam = (teamId: number, checked: boolean) => {
    setEditorTeamIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(teamId);
      else next.delete(teamId);
      return Array.from(next).sort((a, b) => a - b);
    });
  };

  const handleSaveAccess = async () => {
    if (!token || !projectId || !canManageAccess) return;
    setSavingAccess(true);
    try {
      await saveSharedModuleAccess(token, projectId, {
        ownerTeamId: ownerTeamId === '' ? null : ownerTeamId,
        editorTeamIds,
      });
      success('Shared backend access updated');
      await loadAccess(token, projectId);
    } catch (err: any) {
      showError(err.message || 'Failed to update access');
    } finally {
      setSavingAccess(false);
    }
  };

  return {
    teamOptions,
    ownerTeamId,
    editorTeamIds,
    canManageAccess,
    canChangeOwner,
    savingAccess,
    setOwnerTeamId,
    loadAccess,
    toggleEditorTeam,
    handleSaveAccess,
  };
}

export default useSharedModuleAccessState;
