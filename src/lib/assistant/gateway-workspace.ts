import { fetchCodexGateway } from '@/lib/assistant/gateway-fetch';
import { resolveCodexGatewayBaseForUser } from '@/lib/assistant/gateway-runtime';
import type { AgentWorkspaceSession } from '@/lib/assistant/respond-runtime';

type GatewayWorkspaceRequest = {
  userId: string | number;
  userName?: string | null;
  chatId: string;
  tenantId: string;
};

type ActivateWorkspaceRequest = GatewayWorkspaceRequest & {
  session: AgentWorkspaceSession;
};

const postGatewayWorkspace = async <T>(
  path: string,
  payload: Record<string, unknown>,
  userId: string | number,
  userName?: string | null,
): Promise<T> => {
  const runtime = await resolveCodexGatewayBaseForUser(userId, userName);
  const response = await fetchCodexGateway(`${runtime.baseUrl}${path}`, { userId, tenantId: String(payload.tenantId) }, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).trim();
    throw new Error(detail || `Gateway workspace request failed (${response.status})`);
  }
  return (await response.json()) as T;
};

export const activateCodexGatewayWorkspace = async ({
  userId,
  userName,
  chatId,
  tenantId,
  session,
}: ActivateWorkspaceRequest) =>
  postGatewayWorkspace<{
    ok: true;
    workspace: {
      scope: 'tenant' | 'repo';
      workspaceDir: string;
      activatedAt: string;
      lastPreparedAt: string;
      fileCount: number;
      baselineCount: number;
      reused: boolean;
    };
  }>(
    '/v1/workspace/activate',
    {
      userId: String(userId),
      chatId,
      tenantId,
      workspaceScope: 'tenant',
      agentSession: session,
    },
    userId,
    userName,
  );

export const commitCodexGatewayWorkspace = async ({
  userId,
  userName,
  chatId,
  tenantId,
}: GatewayWorkspaceRequest) =>
  postGatewayWorkspace<{
    ok: true;
    workspace: {
      scope: 'tenant' | 'repo';
      workspaceDir: string;
      lastCommittedAt: string;
      baselineCount: number;
      fileCount: number;
    };
  }>(
    '/v1/workspace/commit',
    {
      userId: String(userId),
      chatId,
      tenantId,
      workspaceScope: 'tenant',
    },
    userId,
    userName,
  );

export const resetCodexGatewayWorkspace = async ({
  userId,
  userName,
  chatId,
  tenantId,
}: GatewayWorkspaceRequest) =>
  postGatewayWorkspace<{
    ok: true;
    workspace: {
      scope: 'tenant' | 'repo';
      workspaceDir: string;
      resetAt: string;
      baselineCount: number;
      fileCount: number;
    };
  }>(
    '/v1/workspace/reset',
    {
      userId: String(userId),
      chatId,
      tenantId,
      workspaceScope: 'tenant',
    },
    userId,
    userName,
  );
