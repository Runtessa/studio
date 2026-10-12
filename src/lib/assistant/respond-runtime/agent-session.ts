import { inferTaskExpectations, type TaskExpectations } from './task-scope';
import type { PreviewExceptionEntry } from '@/lib/assistant/preview-exceptions-store';
import type { AssistantChange } from '@/lib/assistant/types';
import {applyEditorContext,type EditorBuffer,type EditorSelection} from './editor-context';
import {
  toModelVirtualPath,
  toModuleVirtualPath,
  toSharedVirtualPath,
  toUiVirtualPath,
} from './workspace-paths';

type WorkspaceContextInput = {
  tenant?: {
    id: string;
    hostname: string;
    adapterAccess?: Record<string, { allow: string[] }>;
    resourceConfig?: { memory?: number; timeout?: number } | null;
    authDbConfig?: { mode?: string; secretKey?: string | null } | null;
  };
  modules: Array<{
    id: string;
    routePath: string;
    method: string;
    code: string;
    fileExtension?: string | null;
  }>;
  models: Array<{
    id: string;
    path: string;
    code: string;
    fileExtension?: string | null;
    draftVersion?: string | null;
  }>;
  uiPackages: Array<{
    id: string;
    name: string;
    version: string;
    code: string;
    dependencies: string[];
    fileExtension?: string | null;
  }>;
  sharedUi: Array<{
    id: string;
    name: string;
    version: string;
    entryPath: string;
    code: string;
    dependencies: string[];
  }>;
  sharedModules: Array<{
    id: string;
    name: string;
    version: string;
    entryPath: string;
    code: string;
    dependencies: string[];
  }>;
  sharedUiFiles?: Array<{
    id: string;
    path: string;
    content: string;
    fileExtension?: string | null;
    projectId: string;
    projectName: string;
  }>;
  sharedModuleFiles?: Array<{
    id: string;
    path: string;
    content: string;
    fileExtension?: string | null;
    projectId: string;
    projectName: string;
  }>;
};

type ActiveFileContext = {
  id: string;
  name: string;
  meta?: unknown;
  content: string;
} | null;

type SessionSourceFile = {
  path: string;
  kind: 'module' | 'model' | 'ui' | 'shared-ui' | 'shared-module' | 'acl';
  id?: string;
  entityName?: string;
  projectId?: string;
  projectName?: string;
  version?: string;
  fileExtension?: string | null;
  dependencies?: string[];
  content: string;
};


export type AgentWorkspaceSession = {
  version: '2026-06-01';
  chatId: string;
  tenant: WorkspaceContextInput['tenant'] | null;
  actor: {
    role: string;
    permissions: string[];
  } | null;
  runtime: {
    mutationRoots: string[];
    uiRules: string[];
    backendRules: string[];
    architectureMap: string[];
    validationRules: string[];
  };
  workspace: {
    openFiles?: Array<{path:string;isDirty:boolean}>;
    selection?: (EditorSelection & {path:string;text:string}) | null;
    stats: {
      modules: number;
      models: number;
      uiPackages: number;
      sharedUiFiles: number;
      sharedModuleFiles: number;
    };
    activeFile: {
      id: string;
      name: string;
      path: string;
      content: string;
    } | null;
    files: SessionSourceFile[];
  };
  acl: {
    permissions: unknown;
    roles: unknown;
    endpoints: unknown;
  };
  preview: {
    enabled: boolean;
    exceptions: Array<{
      level: string;
      kind: string;
      message: string;
      createdAt: string;
      requestUrl?: string;
      method?: string;
      status?: number;
      sourceUrl?: string;
      line?: number;
      column?: number;
      previewName?: string;
      previewVersion?: string;
      responseSnippet?: string;
      stack?: string;
    }>;
  };
  task: {
    objective: string;
    expectations: TaskExpectations;
    recentChangePaths: string[];
    latestRunMessage: string;
    latestRunStatus: string;
  };
};

const parseContextLimit = () => {
  const raw = Number(process.env.AGENT_CONTEXT_MAX_CHARS || '0');
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.floor(raw);
};

const MAX_CONTEXT_CHARS = parseContextLimit();

const truncate = (value: string, max = MAX_CONTEXT_CHARS) => {
  if (!value) return '';
  if (!max || max <= 0) return value;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n…(truncated)`;
};

const summarizePreviewException = (item: PreviewExceptionEntry) => ({
  level: item.level,
  kind: item.kind,
  message: item.message,
  createdAt: item.createdAt,
  requestUrl: item.requestUrl,
  method: item.method,
  status: typeof item.status === 'number' ? item.status : undefined,
  sourceUrl: item.sourceUrl,
  line: typeof item.line === 'number' ? item.line : undefined,
  column: typeof item.column === 'number' ? item.column : undefined,
  previewName: item.previewName,
  previewVersion: item.previewVersion,
  responseSnippet: item.responseSnippet,
  stack: item.stack,
});


const changeToPath = (change: AssistantChange): string | null => {
  if (change.kind === 'module') {
    const target = change.after ?? change.before;
    return target ? toModuleVirtualPath(target) : null;
  }
  if (change.kind === 'model') {
    const target = change.after ?? change.before;
    return target ? toModelVirtualPath(target) : null;
  }
  if (change.kind === 'ui') {
    const target = change.after ?? change.before;
    return target ? toUiVirtualPath(target) : null;
  }
  if (change.kind === 'acl') {
    return `modules/acl/${change.file}.json`;
  }
  if (change.kind === 'shared-file') {
    const target = change.after ?? change.before;
    if (!target) return null;
    return toSharedVirtualPath(
      change.projectKind === 'module' ? 'shared-modules' : 'shared-ui',
      'unknown',
      target.path,
    );
  }
  if (change.kind === 'shared-project') {
    const target = change.after ?? change.before;
    if (!target) return null;
    return toSharedVirtualPath(
      target.kind === 'module' ? 'shared-modules' : 'shared-ui',
      target.name,
      target.entryPath,
    );
  }
  return null;
};

const buildWorkspaceFiles = (workspace: WorkspaceContextInput, acl: AgentWorkspaceSession['acl']) => {
  const files: SessionSourceFile[] = [];
  for (const mod of workspace.modules) {
    files.push({
      path: toModuleVirtualPath(mod),
      kind: 'module',
      id: mod.id,
      entityName: `${mod.method} ${mod.routePath}`,
      fileExtension: mod.fileExtension ?? 'js',
      content: mod.code || '',
    });
  }
  for (const model of workspace.models) {
    files.push({
      path: toModelVirtualPath(model),
      kind: 'model',
      id: model.id,
      entityName: model.path,
      fileExtension: model.fileExtension ?? 'js',
      content: model.code || '',
    });
  }
  files.push({
    path: 'modules/acl/permissions.json',
    kind: 'acl',
    entityName: 'permissions',
    fileExtension: 'json',
    content: JSON.stringify(acl.permissions ?? {}, null, 2),
  });
  files.push({
    path: 'modules/acl/roles.json',
    kind: 'acl',
    entityName: 'roles',
    fileExtension: 'json',
    content: JSON.stringify(acl.roles ?? {}, null, 2),
  });
  files.push({
    path: 'modules/acl/endpoints.json',
    kind: 'acl',
    entityName: 'endpoints',
    fileExtension: 'json',
    content: JSON.stringify(acl.endpoints ?? {}, null, 2),
  });
  for (const pkg of workspace.uiPackages) {
    files.push({
      path: toUiVirtualPath(pkg),
      kind: 'ui',
      id: pkg.id,
      entityName: pkg.name,
      version: pkg.version,
      fileExtension: pkg.fileExtension ?? 'jsx',
      dependencies: pkg.dependencies ?? [],
      content: pkg.code || '',
    });
  }
  for (const file of workspace.sharedUiFiles ?? []) {
    files.push({
      path: toSharedVirtualPath('shared-ui', file.projectName, file.path),
      kind: 'shared-ui',
      id: file.id,
      entityName: file.path,
      projectId: file.projectId,
      projectName: file.projectName,
      fileExtension: file.fileExtension ?? null,
      content: file.content || '',
    });
  }
  if (!(workspace.sharedUiFiles ?? []).length) {
    for (const project of workspace.sharedUi) {
      files.push({
        path: toSharedVirtualPath('shared-ui', project.name, project.entryPath),
        kind: 'shared-ui',
        id: project.id,
        entityName: project.entryPath,
        projectId: project.id,
        projectName: project.name,
        version: project.version,
        dependencies: project.dependencies ?? [],
        content: project.code || '',
      });
    }
  }
  for (const file of workspace.sharedModuleFiles ?? []) {
    files.push({
      path: toSharedVirtualPath('shared-modules', file.projectName, file.path),
      kind: 'shared-module',
      id: file.id,
      entityName: file.path,
      projectId: file.projectId,
      projectName: file.projectName,
      fileExtension: file.fileExtension ?? null,
      content: file.content || '',
    });
  }
  if (!(workspace.sharedModuleFiles ?? []).length) {
    for (const project of workspace.sharedModules) {
      files.push({
        path: toSharedVirtualPath('shared-modules', project.name, project.entryPath),
        kind: 'shared-module',
        id: project.id,
        entityName: project.entryPath,
        projectId: project.id,
        projectName: project.name,
        version: project.version,
        dependencies: project.dependencies ?? [],
        content: project.code || '',
      });
    }
  }
  return files;
};

export const buildAgentWorkspaceSession = (input: {
  chatId: string;
  messages: Array<{ role: string; content: string }>;
  workspace: WorkspaceContextInput;
  acl: AgentWorkspaceSession['acl'];
  preview?: { enabled: boolean; exceptions: PreviewExceptionEntry[] };
  actor?: { role: string; permissions: string[] };
  activeFile?: ActiveFileContext;
  openFiles?: EditorBuffer[];
  selection?: EditorSelection | null;
  previousRun?: {
    message?: string;
    status?: string;
    changes?: AssistantChange[];
  } | null;
}): AgentWorkspaceSession => {
  const files = buildWorkspaceFiles(input.workspace, input.acl);
  const editorContext = applyEditorContext(files,input.activeFile,input.openFiles,input.selection);
  const objective =
    [...input.messages]
      .reverse()
      .find((message) => message.role === 'user' && message.content.trim())?.content || '';
  const activeFilePath = editorContext.selectedFile?.path || '';
  const recentChangePaths = (input.previousRun?.changes || [])
    .map(changeToPath)
    .filter((value): value is string => Boolean(value));

  return {
    version: '2026-06-01',
    chatId: String(input.chatId || 'default'),
    tenant: input.workspace.tenant ?? null,
    actor: input.actor
      ? {
          role: input.actor.role,
          permissions: Array.isArray(input.actor.permissions) ? input.actor.permissions : [],
        }
      : null,
    runtime: {
      mutationRoots: ['modules/...', 'models/...', 'ui/...', 'shared-ui/<project>/...', 'shared-modules/<project>/...'],
      uiRules: [
        'Use @app/datacontext for UI data access; do not use fetch/axios/XMLHttpRequest.',
        'Only @app/dashboard may export App().',
      ],
      backendRules: [
        'Backend modules must export module.exports = async function handler(req, adapters) { ... }.',
        'Database access must use await adapters.orm("<database>:<key>").',
      ],
      architectureMap: [
        'modules/... = backend request handlers and server-side tenant logic',
        'models/... = ORM entities and database-facing model code',
        'ui/... = tenant frontend packages and screens',
        'shared-modules/... = reusable backend/shared libraries',
        'shared-ui/... = reusable frontend/shared UI libraries',
        'modules/acl/... = tenant permission, role, and endpoint ACL definitions',
      ],
      validationRules: [
        'Scope validation should follow the task expectations below, not blanket full-stack mutation rules.',
        'ACL updates are required when backend endpoints or access-control semantics change.',
      ],
    },
    workspace: {
      openFiles:editorContext.openFiles,
      selection:editorContext.selection,
      stats: {
        modules: input.workspace.modules.length,
        models: input.workspace.models.length,
        uiPackages: input.workspace.uiPackages.length,
        sharedUiFiles: (input.workspace.sharedUiFiles ?? input.workspace.sharedUi).length,
        sharedModuleFiles: (input.workspace.sharedModuleFiles ?? input.workspace.sharedModules).length,
      },
      activeFile: input.activeFile && editorContext.selectedFile
        ? {
            id: input.activeFile.id,
            name: input.activeFile.name,
            path: activeFilePath || input.activeFile.name,
            content: input.activeFile.content || '',
          }
        : null,
      files,
    },
    acl: input.acl,
    preview: {
      enabled: input.preview?.enabled === true,
      exceptions: (input.preview?.exceptions ?? []).map(summarizePreviewException),
    },
    task: {
      objective,
      expectations: inferTaskExpectations(objective, activeFilePath),
      recentChangePaths,
      latestRunMessage: String(input.previousRun?.message || ''),
      latestRunStatus: String(input.previousRun?.status || ''),
    },
  };
};

export const renderAgentWorkspaceSession = (session: AgentWorkspaceSession) => {
  const lines: string[] = [];
  lines.push('AGENT SESSION CONTRACT (tenant workspace mode):');
  lines.push('This host has already resolved tenant workspace, ACL, actor access, and preview diagnostics.');
  lines.push('Do not ask for them again. Plan mutations against the exact virtual roots below.');
  lines.push('');
  lines.push('SESSION MANIFEST JSON:');
  lines.push(
    truncate(
      JSON.stringify(
        {
          version: session.version,
          chatId: session.chatId,
          tenant: session.tenant,
          actor: session.actor,
          runtime: session.runtime,
          workspace: {
            stats: session.workspace.stats,
            activeFile: session.workspace.activeFile
              ? {
                  id: session.workspace.activeFile.id,
                  name: session.workspace.activeFile.name,
                  path: session.workspace.activeFile.path,
                }
              : null,
            files: session.workspace.files.map((file) => ({
              path: file.path,
              kind: file.kind,
              id: file.id,
              entityName: file.entityName,
              projectName: file.projectName,
              version: file.version,
              dependencies: file.dependencies ?? [],
            })),
          },
          acl: session.acl,
          task: session.task,
          preview: {
            enabled: session.preview.enabled,
            count: session.preview.exceptions.length,
          },
        },
        null,
        2,
      ),
    ),
  );
  lines.push('');
  lines.push('TASK EXPECTATIONS:');
  lines.push(`- objective: ${session.task.objective || '(empty)'}`);
  lines.push(`- mode: ${session.task.expectations.mode}`);
  lines.push(`- autonomous surface selection: ${session.task.expectations.autonomous ? 'enabled' : 'disabled'}`);
  lines.push(
    `- expected surfaces: ${[
      session.task.expectations.backend ? 'backend' : '',
      session.task.expectations.models ? 'models' : '',
      session.task.expectations.ui ? 'ui' : '',
      session.task.expectations.acl ? 'acl' : '',
      session.task.expectations.shared ? 'shared' : '',
      session.task.expectations.preview ? 'preview' : '',
    ]
      .filter(Boolean)
      .join(', ') || 'none detected'}`,
  );
  session.task.expectations.reasons.forEach((reason) => {
    lines.push(`- rationale: ${reason}`);
  });
  if (session.task.latestRunStatus || session.task.latestRunMessage) {
    lines.push(`- previous run status: ${session.task.latestRunStatus || 'unknown'}`);
    if (session.task.latestRunMessage) {
      lines.push(`- previous run summary: ${truncate(session.task.latestRunMessage, 4000)}`);
    }
  }
  if (session.task.recentChangePaths.length) {
    lines.push(`- recent change paths: ${session.task.recentChangePaths.join(', ')}`);
  }
  lines.push('');
  lines.push('FULL SOURCE SNAPSHOT:');
  session.workspace.files.forEach((file) => {
    lines.push(`# FILE: ${file.path}`);
    if (file.dependencies?.length) {
      lines.push(`# DEPENDENCIES: ${file.dependencies.join(', ')}`);
    }
    lines.push(file.content || '');
    lines.push('');
  });
  lines.push('PREVIEW EXCEPTIONS:');
  if (!session.preview.enabled) {
    lines.push('Watch mode: disabled');
  } else if (!session.preview.exceptions.length) {
    lines.push('Watch mode: enabled, no recent exceptions');
  } else {
    session.preview.exceptions.forEach((item, index) => {
      lines.push(`# EXCEPTION ${index + 1}: [${item.level}] ${item.kind} at ${item.createdAt}`);
      lines.push(`message: ${item.message}`);
      if (item.requestUrl) {
        lines.push(
          `request: ${item.method || 'GET'} ${item.requestUrl}${item.status ? ` (status ${item.status})` : ''}`,
        );
      }
      if (item.sourceUrl) {
        lines.push(
          `source: ${item.sourceUrl}${
            item.line ? `:${item.line}${item.column ? `:${item.column}` : ''}` : ''
          }`,
        );
      }
      if (item.responseSnippet) lines.push(`response: ${item.responseSnippet}`);
      if (item.stack) {
        lines.push('stack:');
        lines.push(truncate(item.stack, 2000));
      }
      lines.push('');
    });
  }
  return lines.join('\n');
};
