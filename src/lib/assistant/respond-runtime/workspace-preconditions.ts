import type { WorkspaceContext } from './workspace-context';
import type { CodexOperation } from './codex-types';
import type { AssistantChange } from '../types';
import { normalizeOperationInput, normalizeProjectKind, toToolId, pickInput } from './codex-normalization';
import { buildOperationsFromDirectives } from './codex-directives';
import { snapshot } from './workspace-snapshot';
import { overlayOwnChanges } from './workspace-overlay';

function targets(operation: CodexOperation, workspace: WorkspaceContext): string[] {
  const tool = toToolId(
    String(operation.tool || operation.name || operation.action || operation.toolId || ''),
  );
  if (/^(create|update|delete)_file$/.test(tool)) {
    const raw = operation.input || {};
    const path = pickInput(raw, ['path', 'filePath', 'file', 'virtualPath']);
    if (typeof path !== 'string') return [];
    return buildOperationsFromDirectives(
      [
        {
          path,
          action: tool === 'delete_file' ? 'delete' : tool === 'create_file' ? 'create' : 'edit',
          content: '',
        },
      ],
      workspace,
    ).flatMap((op) => targets(op, workspace));
  }
  const input = normalizeOperationInput(tool, operation.input || {}, workspace) as Record<string, any>;
  if (/^(create|update|delete)_module$/.test(tool))
    return [
      input.id && `module:${input.id}`,
      input.routePath && `module:${input.method || 'GET'}:${input.routePath}`,
    ].filter(Boolean);
  if (/^(create|update|delete)_model$/.test(tool))
    return [
      input.id && `model:${input.id}`,
      input.path && `model:${input.path}`,
      input.newPath && `model:${input.newPath}`,
    ].filter(Boolean);
  if (/^(create|update|delete)_ui_package$/.test(tool))
    return [
      input.id && `ui:${input.id}`,
      input.name && `ui:${input.name}@${input.version || '1.0.0'}`,
    ].filter(Boolean);
  if (tool === 'update_acl_file') return [`acl:${input.file}`];
  const kind = normalizeProjectKind(input.projectKind) || (tool.includes('_module_') ? 'module' : 'ui');
  if (tool === 'write_shared_file' || tool === 'delete_shared_file') {
    return [
      input.projectId && `project:${kind}:${input.projectId}`,
      input.projectId && `shared:${kind}:${input.projectId}:${input.path}`,
      input.projectName && `shared:${kind}:${input.projectName}@${input.version || '1.0.0'}:${input.path}`,
    ].filter(Boolean);
  }
  if (tool === 'create_shared_ui_project' || tool === 'create_shared_module_project')
    return [`project:${kind}:${input.name}@${input.version || '1.0.0'}`];
  return [];
}

export function assertWorkspacePreconditions(input: {
  baseline: WorkspaceContext;
  current: WorkspaceContext;
  baselineAcl: Record<string, unknown>;
  currentAcl: Record<string, unknown>;
  operations: CodexOperation[];
  appliedChanges?: AssistantChange[];
}) {
  const { expected, acl } = overlayOwnChanges(input.baseline, input.baselineAcl, input.appliedChanges);
  const before = snapshot(expected, acl);
  const now = snapshot(input.current, input.currentAcl);
  const changed = [
    ...new Set(input.operations.flatMap((operation) => targets(operation, input.baseline))),
  ].filter((key) => before.get(key) !== now.get(key));
  if (changed.length)
    throw Object.assign(
      new Error(
        `Files changed while the assistant was working: ${changed.join(', ')}. Retry from the current workspace.`,
      ),
      { code: 'assistant-workspace-conflict' },
    );
}
