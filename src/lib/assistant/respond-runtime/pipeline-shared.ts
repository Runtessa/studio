import type { AssistantChange } from '@/lib/assistant/types';
import type { AssistantRunEvent } from '@/lib/assistant/orchestrator';
import type { AgentWorkspaceSession } from './workspace-context';
import { normalizePath, normalizeProjectKind, pickInput, toToolId, type CodexOperation } from './codex-ops';

export type CodexConflict = {
  id: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  relatedNodeIds: string[];
};

export const createRunEvent = (
  runId: string,
  type: AssistantRunEvent['type'],
  phase: AssistantRunEvent['phase'],
  payload?: Record<string, unknown>,
): AssistantRunEvent => ({
  id:
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `evt-${Math.random().toString(36).slice(2, 12)}`,
  runId,
  type,
  phase,
  timestamp: new Date().toISOString(),
  payload,
});

export const promptLooksLikeMutation = (prompt: string) =>
  !/\bread[ -]only\b/i.test(prompt) && /\b(create|edit|update|delete|remove|add|implement|fix|refactor|build|redesign|design|change|modify|improve|migrate)\b/i.test(
    prompt,
  );

const createConflict = (
  message: string,
  severity: CodexConflict['severity'],
  relatedNodeIds: string[],
): CodexConflict => ({
  id:
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `conflict-${Math.random().toString(36).slice(2, 10)}`,
  message,
  severity,
  relatedNodeIds,
});

export const buildCodexDagFromEvents = (runId: string, events: AssistantRunEvent[]) => {
  const nodes = events.map((event, index) => ({
    id: `${runId}-node-${index + 1}`,
    label: event.type,
    phase: event.phase,
    status:
      event.type === 'RUN_FAILED'
        ? 'failed'
        : event.type === 'RUN_REQUESTED' ||
            event.type === 'CONTEXT_CAPTURED' ||
            event.type === 'PLAN_READY' ||
            event.type === 'EXECUTION_STARTED' ||
            event.type === 'EXECUTION_COMPLETED' ||
            event.type === 'RUN_COMPLETED'
          ? 'completed'
          : 'running',
    attempt: Number(event.payload?.attempt ?? 0),
  }));
  const edges = nodes
    .map((node, index) => {
      if (index === 0) return null;
      const previous = nodes[index - 1];
      const event = events[index];
      return {
        fromNodeId: previous.id,
        toNodeId: node.id,
        eventType: event.type,
      };
    })
    .filter(Boolean);
  return { nodes, edges } as {
    nodes: Array<{
      id: string;
      label: string;
      phase: AssistantRunEvent['phase'];
      status: 'pending' | 'running' | 'completed' | 'failed';
      attempt: number;
    }>;
    edges: Array<{
      fromNodeId: string;
      toNodeId: string;
      eventType: AssistantRunEvent['type'];
    }>;
  };
};

const buildCoverageState = (
  operations: CodexOperation[],
  changes: AssistantChange[],
): { backend: boolean; models: boolean; ui: boolean; acl: boolean; shared: boolean } => {
  const state = { backend: false, models: false, ui: false, acl: false, shared: false };
  for (const op of operations) {
    const tool = toToolId(String(op.tool || op.name || op.action || op.toolId || ''));
    const opInput =
      op.input && typeof op.input === 'object' && !Array.isArray(op.input)
        ? (op.input as Record<string, unknown>)
        : {};
    if (tool === 'create_module' || tool === 'update_module' || tool === 'delete_module') {
      state.backend = true;
    }
    if (tool === 'create_model' || tool === 'update_model' || tool === 'delete_model') {
      state.models = true;
    }
    if (
      tool === 'create_ui_package' ||
      tool === 'update_ui_package' ||
      tool === 'delete_ui_package' ||
      tool === 'create_shared_ui_project'
    ) {
      state.ui = true;
    }
    if (tool === 'create_shared_module_project') {
      state.backend = true;
      state.shared = true;
    }
    if (tool === 'write_shared_file' || tool === 'delete_shared_file') {
      const projectKind = normalizeProjectKind(opInput?.projectKind);
      state.shared = true;
      if (projectKind === 'module') {
        state.backend = true;
      } else {
        state.ui = true;
      }
    }
    if (tool === 'create_file' || tool === 'update_file' || tool === 'delete_file') {
      const rawPath = pickInput(opInput, ['path', 'filePath', 'file', 'virtualPath']);
      const path = typeof rawPath === 'string' ? normalizePath(rawPath) : '';
      const lower = path.toLowerCase();
      if (lower.startsWith('modules/acl/')) {
        state.acl = true;
      } else if (lower.startsWith('modules/')) {
        state.backend = true;
      } else if (lower.startsWith('models/')) {
        state.models = true;
      } else if (lower.startsWith('shared-modules/') || lower.startsWith('shared-backend/')) {
        state.backend = true;
        state.shared = true;
      } else if (lower.startsWith('ui/')) {
        state.ui = true;
      } else if (lower.startsWith('shared-ui/')) {
        state.ui = true;
        state.shared = true;
      }
    }
    if (tool === 'update_acl_file') {
      state.acl = true;
    }
  }
  for (const change of changes) {
    if (change.kind === 'module') state.backend = true;
    if (change.kind === 'model') state.models = true;
    if (change.kind === 'ui') state.ui = true;
    if (change.kind === 'shared-file') {
      state.shared = true;
      if (change.projectKind === 'module') state.backend = true;
      else state.ui = true;
    }
    if (change.kind === 'shared-project') {
      state.shared = true;
      if (change.after?.kind === 'module' || change.before?.kind === 'module') {
        state.backend = true;
      } else {
        state.ui = true;
      }
    }
    if (change.kind === 'acl') state.acl = true;
  }
  return state;
};

const applyDirectWorkspaceEditCoverage = (
  state: {
    backend: boolean;
    models: boolean;
    ui: boolean;
    acl: boolean;
    shared: boolean;
  },
  directWorkspaceEdits: Array<{ path: string }>,
) => {
  for (const edit of directWorkspaceEdits) {
    const filePath = String(edit.path || '').replace(/\\/g, '/');
    if (!filePath) continue;
    if (
      filePath.startsWith('src/core/') ||
      filePath.startsWith('src/auth/') ||
      filePath.startsWith('src/container-agent/') ||
      filePath.startsWith('src/codex-gateway/')
    ) {
      state.backend = true;
    }
    if (
      filePath.includes('/entities/') ||
      filePath.includes('/migrations/') ||
      filePath.startsWith('src/packages/shared/src/entities/')
    ) {
      state.models = true;
    }
    if (
      filePath.startsWith('src/ideNew/') ||
      filePath.startsWith('src/auth/pages/') ||
      filePath.startsWith('src/auth/components/')
    ) {
      state.ui = true;
    }
    if (filePath.includes('/acl/') || /permissions|roles|endpoints/.test(filePath)) {
      state.acl = true;
    }
    if (filePath.startsWith('src/packages/shared/') || filePath.includes('/shared/')) {
      state.shared = true;
    }
  }
  return state;
};

const shouldRequireSurface = (session: AgentWorkspaceSession, surface: keyof AgentWorkspaceSession['task']['expectations']) =>
  Boolean(session.task.expectations[surface]);

export const buildCoverageConflicts = (
  session: AgentWorkspaceSession,
  operations: CodexOperation[],
  changes: AssistantChange[],
  directWorkspaceEdits: Array<{ path: string }> = [],
  opErrors: string[],
  relatedNodeIds: string[],
) => {
  const conflicts: CodexConflict[] = [];
  if (opErrors.length) {
    conflicts.push(
      createConflict(`Operation failures: ${opErrors.join(' | ')}`, 'high', relatedNodeIds),
    );
  }
  const looksLikeMutation = session.task.expectations.mode !== 'read-only' &&
    promptLooksLikeMutation(session.task.objective || '');
  if (!looksLikeMutation) return conflicts;
  if (!changes.length && !directWorkspaceEdits.length) {
    conflicts.push(
      createConflict('Mutation request produced no applied workspace changes.', 'high', relatedNodeIds),
    );
  }
  const coverage = applyDirectWorkspaceEditCoverage(
    buildCoverageState(operations, changes),
    directWorkspaceEdits,
  );
  if (shouldRequireSurface(session, 'backend') && !coverage.backend) {
    conflicts.push(
      createConflict(
        'Missing backend module changes for the current task scope.',
        'high',
        relatedNodeIds,
      ),
    );
  }
  if (shouldRequireSurface(session, 'models') && !coverage.models) {
    conflicts.push(
      createConflict(
        'Missing ORM model changes for the current task scope.',
        'high',
        relatedNodeIds,
      ),
    );
  }
  if (shouldRequireSurface(session, 'ui') && !coverage.ui) {
    conflicts.push(
      createConflict(
        'Missing UI package/file changes for the current task scope.',
        'high',
        relatedNodeIds,
      ),
    );
  }
  if (shouldRequireSurface(session, 'acl') && !coverage.acl) {
    conflicts.push(
      createConflict(
        'Missing ACL updates for backend/access-control scope.',
        'high',
        relatedNodeIds,
      ),
    );
  }
  if (shouldRequireSurface(session, 'shared') && !coverage.shared) {
    conflicts.push(
      createConflict(
        'Missing shared project/file changes for the current task scope.',
        'medium',
        relatedNodeIds,
      ),
    );
  }
  return conflicts;
};

export const buildTargetedRepairPrompt = (
  session: AgentWorkspaceSession,
  prompt: string,
  conflicts: CodexConflict[],
) => {
  const lines = conflicts.map((item) => `- ${item.message}`);
  const expectedSurfaces = [
    session.task.expectations.backend ? 'backend modules' : '',
    session.task.expectations.models ? 'ORM models' : '',
    session.task.expectations.ui ? 'UI files/packages' : '',
    session.task.expectations.acl ? 'ACL files' : '',
    session.task.expectations.shared ? 'shared project files' : '',
  ]
    .filter(Boolean)
    .join(', ');
  return `Previous execution has conflicts and must be repaired with targeted operations only.
Recompute the minimal operation set needed to fix these conflicts:
${lines.join('\n')}

Rules:
- Return JSON only with { "summary", "operations" }.
- Respect the task scope from the tenant session contract.
- Required surfaces for this task: ${expectedSurfaces || 'none explicitly required'}.
- Never use mock/fake/sample/dummy placeholder data.
- Backend ORM calls must be await adapters.orm('<database>:<key>').
- UI networking must use @app/datacontext (no fetch/axios/XMLHttpRequest).
- Provide all required input fields for each tool.
- Do not repeat already successful no-op operations.

Original user request:
${prompt || '(empty)'}`;
};
