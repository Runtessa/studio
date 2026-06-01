import type { PreviewExceptionEntry } from '@/lib/assistant/preview-exceptions-store';
import {
  buildAgentWorkspaceSession,
  renderAgentWorkspaceSession,
  type AgentWorkspaceSession,
} from './agent-session';
import {
  toModelVirtualPath,
  toModuleVirtualPath,
  toSharedVirtualPath,
  toUiVirtualPath,
} from './workspace-paths';

export type WorkspaceContext = {
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

export const buildContextText = (
  workspace: WorkspaceContext,
  acl: { permissions: unknown; roles: unknown; endpoints: unknown },
  preview?: { enabled: boolean; exceptions: PreviewExceptionEntry[] },
  actor?: { role: string; permissions: string[] },
  options?: {
    chatId?: string;
    messages?: Array<{ role: string; content: string }>;
    activeFile?: {
      id: string;
      name: string;
      meta?: unknown;
      content: string;
    } | null;
    previousRun?: {
      message?: string;
      status?: string;
      changes?: import('@/lib/assistant/types').AssistantChange[];
    } | null;
  },
) =>
  renderAgentWorkspaceSession(
    buildAgentWorkspaceSession({
      chatId: options?.chatId || 'default',
      messages: options?.messages ?? [],
      workspace,
      acl,
      preview,
      actor,
      activeFile: options?.activeFile,
      previousRun: options?.previousRun,
    }),
  );

export {
  buildAgentWorkspaceSession,
  renderAgentWorkspaceSession,
  toModuleVirtualPath,
  toModelVirtualPath,
  toUiVirtualPath,
  toSharedVirtualPath,
};

export type { AgentWorkspaceSession };
