import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import {
  getServiceState,
  getContainerManagerVersion,
  hasContainerOrchestrator,
  listContainers,
  listServices,
} from '@/lib/container-orchestrator-client';

type ServiceRecord = {
  key: string;
  userScoped?: boolean;
  managed?: boolean;
};

type ServiceState = {
  service?: string;
  userKey?: string;
  containerName?: string;
  engine?: string;
  image?: string;
  exists?: boolean;
  running?: boolean;
  port?: number | null;
  host?: string;
  baseUrl?: string;
};

type ServiceStatePayload = {
  ok?: boolean;
  state?: ServiceState;
};

type ServicesPayload = {
  ok?: boolean;
  services?: ServiceRecord[];
};

type ContainersPayload = {
  ok?: boolean;
  containers?: Array<{
    id: string;
    names?: string[];
    image?: string;
    state?: string;
    status?: string;
    labels?: Record<string, string>;
    ports?: Array<Record<string, unknown>>;
  }>;
};

const firstString = (value: string | string[] | undefined) =>
  Array.isArray(value) ? String(value[0] || '') : String(value || '');

const resolveTargetAgent = (req: NextApiRequest) => {
  const fromQuery = firstString(req.query.agentId).trim();
  return fromQuery || String(process.env.AGENT_CONTAINER_MANAGER_TARGET || '').trim() || undefined;
};

export default withApiHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end();
    return;
  }

  const user = await requireAdmin(req);

  if (!hasContainerOrchestrator()) {
    res.status(200).json({
      ok: true,
      configured: false,
      managerVersion: null,
      services: [],
      containers: [],
      selectedUser: {
        userId: String(user.id),
        userName: user.email,
      },
    });
    return;
  }

  const selectedUserId = firstString(req.query.userId) || String(user.id);
  const selectedUserName = firstString(req.query.userName) || user.email;
  const targetAgent = resolveTargetAgent(req);

  const [managerVersion, servicesPayload, containersPayload] = await Promise.all([
    getContainerManagerVersion(targetAgent).catch((error: any) => ({
      ok: false,
      error: String(error?.message || error || 'failed'),
    })),
    listServices(targetAgent) as Promise<ServicesPayload>,
    listContainers({}, targetAgent) as Promise<ContainersPayload>,
  ]);

  const services = Array.isArray(servicesPayload?.services) ? servicesPayload.services : [];
  const states = await Promise.all(
    services.map(async (service) => {
      try {
        const payload = (await getServiceState(
          {
            service: service.key,
            ...(service.userScoped
              ? {
                  userId: selectedUserId,
                  userName: selectedUserName,
                }
              : {}),
          },
          targetAgent
        )) as ServiceStatePayload;
        return {
          service: service.key,
          userScoped: Boolean(service.userScoped),
          managed: Boolean(service.managed),
          state: payload?.state || null,
          error: null,
        };
      } catch (error: any) {
        return {
          service: service.key,
          userScoped: Boolean(service.userScoped),
          managed: Boolean(service.managed),
          state: null,
          error: String(error?.message || error || 'failed'),
        };
      }
    })
  );

  res.status(200).json({
    ok: true,
    configured: true,
    managerVersion,
    services,
    states,
    containers: Array.isArray(containersPayload?.containers)
      ? containersPayload.containers
      : [],
    selectedUser: {
      userId: selectedUserId,
      userName: selectedUserName,
    },
  });
});
