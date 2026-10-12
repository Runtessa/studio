import type { CodexOperation } from './codex-types';
import type { WorkspaceContext } from './workspace-context';
import { normalizeOperationInput, normalizeProjectKind, pickInput, toToolId } from './codex-normalization';
import { buildOperationsFromDirectives } from './codex-directives';

export function sharedWriteResources(operations: CodexOperation[], workspace: WorkspaceContext): string[] {
  const resources = new Set<string>();
  for (const op of operations) {
    const tool = toToolId(String(op.tool || op.name || op.action || op.toolId || ''));
    if (/^(create|update|delete)_file$/.test(tool)) {
      const raw = op.input || {};
      const path = pickInput(raw, ['path', 'filePath', 'file', 'virtualPath']);
      if (typeof path !== 'string') continue;
      const mapped = buildOperationsFromDirectives(
        [{ path, action: tool === 'delete_file' ? 'delete' : 'edit', content: '' }],
        workspace,
      );
      sharedWriteResources(mapped, workspace).forEach((resource) => resources.add(resource));
      continue;
    }
    if (
      ![
        'write_shared_file',
        'delete_shared_file',
        'create_shared_ui_project',
        'create_shared_module_project',
      ].includes(tool)
    )
      continue;
    const input = normalizeOperationInput(tool, op.input || {}, workspace);
    const kind = normalizeProjectKind(input.projectKind) || (tool.includes('_module_') ? 'module' : 'ui');
    const projects = kind === 'module' ? workspace.sharedModules : workspace.sharedUi;
    const project = projects.find((row) => row.id === input.projectId || row.name === input.projectName);
    const name = project?.name || input.projectName || input.name;
    if (!name) continue;
    resources.add(`assistant:shared-writer:${kind}:${name}@${project?.version || input.version || '1.0.0'}`);
  }
  return [...resources].sort();
}
