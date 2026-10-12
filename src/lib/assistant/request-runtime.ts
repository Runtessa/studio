import { buildAssistantTools } from '@/lib/assistant/tools';
import { listPreviewExceptions } from '@/lib/assistant/preview-exceptions-store';
import { getLatestAssistantRun } from '@/lib/assistant/state-store';
import type { IdePermission } from '@/lib/rbac';
import {
  buildAgentWorkspaceSession,
  executeTool,
  resolvePreviewExceptionsLimit,
  shouldWatchPreviewFromPrompt,
  type WorkspaceContext,
} from '@/lib/assistant/respond-runtime';
import type { AssistantChange } from '@/lib/assistant/types';
import type { Tenant } from '@idp/shared';
import type {EditorBuffer,EditorSelection} from './respond-runtime/editor-context';
import { renderAgentWorkspaceSession } from './respond-runtime/agent-session';

export type RawAssistantContext = {
  readOnly?: boolean;
  openFiles?: EditorBuffer[];
  selection?: EditorSelection | null;
  watchPreviewExceptions?: unknown;
  previewExceptionsLimit?: unknown;
  activeFile?: {
    id: string;
    name: string;
    meta?: unknown;
    content: string;
  } | null;
};

type RuntimeUser = {
  id: number;
  normalizedRole: string;
  permissions: IdePermission[];
  isAdmin: boolean;
  activeTeamId?: number | null;
};

type BuildAssistantRequestRuntimeInput = {
  tenant: Tenant;
  user: RuntimeUser;
  chatId: string;
  messages: Array<{ role: string; content: string }>;
  context: RawAssistantContext | null;
  changes: AssistantChange[];
};

export const buildAssistantRequestRuntime = async ({
  tenant,
  user,
  chatId,
  messages,
  context,
  changes,
}: BuildAssistantRequestRuntimeInput) => {
  const tools = buildAssistantTools({
    tenant,
    userId: user.id,
    role: user.normalizedRole,
    permissions: user.permissions,
    isAdmin: user.isAdmin,
    activeTeamId: user.activeTeamId,
    changes,
  });

  const workspace = await executeTool<WorkspaceContext, Record<string, never>>(tools.list_workspace, {});
  const acl = await executeTool<{
    permissions: unknown;
    roles: unknown;
    endpoints: unknown;
  }, Record<string, never>>(tools.get_acl_config, {});

  const watchPreviewExceptions =
    context?.watchPreviewExceptions === true || shouldWatchPreviewFromPrompt(messages);
  const previewExceptionsLimit = resolvePreviewExceptionsLimit(context?.previewExceptionsLimit);
  const previewExceptions = watchPreviewExceptions
    ? await listPreviewExceptions(tenant.id, String(user.id), previewExceptionsLimit)
    : [];

  const previousRun = await getLatestAssistantRun(tenant.id, user.id, chatId);

  const normalizedWorkspace = {
    tenant: workspace.tenant ?? undefined,
    modules: workspace.modules ?? [],
    models: workspace.models ?? [],
    uiPackages: workspace.uiPackages ?? [],
    sharedUi: workspace.sharedUi ?? [],
    sharedModules: workspace.sharedModules ?? [],
    sharedUiFiles: workspace.sharedUiFiles ?? [],
    sharedModuleFiles: workspace.sharedModuleFiles ?? [],
  };

  const normalizedAcl = {
    permissions: acl.permissions,
    roles: acl.roles,
    endpoints: acl.endpoints,
  };

  const preview = {
    enabled: watchPreviewExceptions,
    exceptions: previewExceptions,
  };

  const actor = {
    role: user.normalizedRole,
    permissions: user.permissions || [],
  };

  const session = buildAgentWorkspaceSession({
    chatId,
    messages,
    workspace: normalizedWorkspace,
    acl: normalizedAcl,
    preview,
    actor,
    activeFile: context?.activeFile ?? null,
    previousRun,
    openFiles:Array.isArray(context?.openFiles) ? context.openFiles : [],
    selection:context?.selection,
  });

  if (context?.readOnly === true) {
    session.task.expectations.mode = 'read-only';
    session.task.expectations.reasons.push('user selected read-only mode');
  }
  const contextText = renderAgentWorkspaceSession(session);

  return {
    tools,
    workspace,
    acl: normalizedAcl,
    preview,
    actor,
    session,
    contextText,
  };
};
