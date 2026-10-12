import type { WorkspaceContext } from './workspace-context';
import type { AssistantChange } from '../types';

export function overlayOwnChanges(
  baseline: WorkspaceContext,
  baselineAcl: Record<string, unknown>,
  appliedChanges: AssistantChange[] = [],
) {
  const expected = {
    ...baseline,
    modules: [...baseline.modules],
    models: [...baseline.models],
    uiPackages: [...baseline.uiPackages],
    sharedUi: [...baseline.sharedUi],
    sharedModules: [...baseline.sharedModules],
    sharedUiFiles: [...(baseline.sharedUiFiles || [])],
    sharedModuleFiles: [...(baseline.sharedModuleFiles || [])],
  };
  const acl = { ...baselineAcl };
  const replace = (
    rows: Array<any>,
    change: { before?: { id: string } | null; after?: { id: string } | null },
  ) => {
    const id = change.before?.id || change.after?.id;
    const index = rows.findIndex((row) => row.id === id);
    if (index >= 0) rows.splice(index, 1);
    if (change.after) rows.push(change.after);
  };
  for (const change of appliedChanges || []) {
    if (change.kind === 'acl') acl[change.file] = change.after;
    else if (change.kind === 'module') replace(expected.modules, change);
    else if (change.kind === 'model') replace(expected.models, change);
    else if (change.kind === 'ui') replace(expected.uiPackages, change);
    else if (change.kind === 'shared-project')
      replace(
        change.after?.kind === 'module' || change.before?.kind === 'module'
          ? expected.sharedModules
          : expected.sharedUi,
        change,
      );
    else if (change.kind === 'shared-file') {
      const projects = change.projectKind === 'module' ? expected.sharedModules : expected.sharedUi;
      const project = projects.find((row) => row.id === change.projectId);
      replace(change.projectKind === 'module' ? expected.sharedModuleFiles : expected.sharedUiFiles, {
        ...change,
        after: change.after
          ? { ...change.after, projectId: change.projectId, projectName: project?.name || '' }
          : null,
      } as any);
    }
  }
  return { expected, acl };
}
