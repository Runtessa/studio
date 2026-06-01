import { buildAssistantTools } from '@/lib/assistant/tools';
import { listPreviewExceptions } from '@/lib/assistant/preview-exceptions-store';
import { getAssistantRun } from '@/lib/assistant/state-store';
import {
  buildAgentWorkspaceSession,
  buildContextText,
  createRunId,
  executeTool,
  resolvePreviewExceptionsLimit,
  shouldWatchPreviewFromPrompt,
  type WorkspaceContext,
} from '@/lib/assistant/respond-runtime';
import type { AssistantChange } from '@/lib/assistant/types';

export type RawAssistantContext = {
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
  id: string | number;
  normalizedRole: string;
  permissions?: string[];
  isAdmin?: boolean;
  activeTeamId?: string | null;
};

type RuntimeTenant = {
  id: string;
};

type BuildAssistantRequestRuntimeInput = {
  tenant: RuntimeTenant;
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

  const runId = createRunId(chatId);
  const previousRun = await getAssistantRun(tenant.id, runId);

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
  });

  const contextText = buildContextText(normalizedWorkspace, normalizedAcl, preview, actor, {
    chatId,
    messages,
    activeFile: context?.activeFile ?? null,
    previousRun,
  });

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
