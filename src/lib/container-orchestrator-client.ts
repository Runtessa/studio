import { randomUUID } from 'node:crypto';
import redis from '@/lib/redis';

const REQUEST_CHANNEL_PREFIX =
  process.env.CONTAINER_ORCHESTRATOR_REQUEST_CHANNEL_PREFIX || 'idp:orchestrator:requests:';
const REPLY_CHANNEL_PREFIX =
  process.env.CONTAINER_ORCHESTRATOR_REPLY_CHANNEL_PREFIX || 'idp:orchestrator:reply:';
const REQUEST_TIMEOUT_MS = Math.max(
  1_000,
  Number(process.env.CONTAINER_ORCHESTRATOR_TIMEOUT_MS || '20000') || 20_000
);
const REQUESTOR_ID = String(process.env.CONTAINER_ORCHESTRATOR_REQUESTOR_ID || 'ide').trim();
const resolveDefaultTargetAgent = () =>
  String(process.env.AGENT_CONTAINER_MANAGER_TARGET || '').trim();

const toErrorMessage = (value: unknown) => {
  if (!value) return 'orchestrator request failed';
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  return String(value);
};

type OrchestratorEnvelope<TPayload> = {
  targetAgent?: string;
  payload?: TPayload;
};

const requestOrchestrator = async <TPayload extends object, TResponse>(
  command: string,
  input?: OrchestratorEnvelope<TPayload>
): Promise<TResponse> => {
  const commandId = randomUUID();
  const replyChannel = `${REPLY_CHANNEL_PREFIX}${commandId}`;
  const payload = input?.payload || ({} as TPayload);
  const targetAgent = String(input?.targetAgent || resolveDefaultTargetAgent()).trim();
  if (!targetAgent) {
    throw new Error('AGENT_CONTAINER_MANAGER_TARGET is not configured');
  }
  const requestChannel = `${REQUEST_CHANNEL_PREFIX}${targetAgent}`;
  const sub = redis.duplicate();
  if (sub.status === 'wait') {
    await sub.connect();
  }
  await sub.subscribe(replyChannel);

  try {
    const timeout = Math.max(1_000, REQUEST_TIMEOUT_MS);
    const waitForReply = new Promise<Record<string, unknown>>((resolve, reject) => {
      let timer: NodeJS.Timeout | null = setTimeout(() => {
        timer = null;
        reject(new Error(`orchestrator request timed out (${command})`));
      }, timeout);

      const handler = (channel: string, message: string) => {
        if (channel !== replyChannel) return;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        sub.off('message', handler);
        try {
          resolve(JSON.parse(String(message || '{}')) as Record<string, unknown>);
        } catch (error) {
          reject(error);
        }
      };
      sub.on('message', handler);
    });

    await redis.publish(
      requestChannel,
      JSON.stringify({
        id: commandId,
        command,
        payload,
        replyChannel,
        requestedAt: new Date().toISOString(),
        requestor: REQUESTOR_ID,
        targetAgent,
      })
    );

    const parsed = await waitForReply;
    const ok = String(parsed.ok || '').toLowerCase() === 'true';
    const data = parsed.data || null;
    const error = parsed.error ? String(parsed.error) : '';
    if (!ok) {
      throw new Error(error || toErrorMessage((data as any)?.error));
    }
    return data as TResponse;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  } finally {
    await sub.unsubscribe(replyChannel).catch(() => {});
    sub.disconnect();
  }
};

export type OrchestratorServiceRecord = {
  key: string;
  userScoped?: boolean;
  managed?: boolean;
};

export type OrchestratorServiceState = {
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
  service: string;
  userId?: string;
  userName?: string;
};

type ServiceActionPayload = ServiceStatePayload & {
  action: string;
  preferredPort?: number;
};

type ContainerActionPayload = {
  containerName: string;
  action: string;
};

type ContainerCreatePayload = {
  image: string;
  name?: string;
  env?: string[];
  envMap?: Record<string, string>;
  binds?: string[];
  ports?: Array<Record<string, unknown>>;
  cmd?: string[];
  entrypoint?: string[];
  restartPolicy?: string;
  autoStart?: boolean;
  managed?: boolean;
  labels?: Record<string, string>;
};

export const hasContainerOrchestrator = () => Boolean(resolveDefaultTargetAgent());

export const getContainerManagerVersion = (targetAgent?: string) =>
  requestOrchestrator<{}, { ok?: boolean; service?: string; version?: string; startedAt?: string }>(
    'manager.version',
    { targetAgent, payload: {} }
  );

export const listServices = (targetAgent?: string) =>
  requestOrchestrator<{}, { ok?: boolean; services?: OrchestratorServiceRecord[] }>(
    'service.list',
    { targetAgent, payload: {} }
  );

export const getServiceState = (payload: ServiceStatePayload, targetAgent?: string) =>
  requestOrchestrator<ServiceStatePayload, { ok?: boolean; state?: OrchestratorServiceState }>(
    'service.state',
    { payload, targetAgent }
  );

export const applyServiceAction = (payload: ServiceActionPayload, targetAgent?: string) =>
  requestOrchestrator<ServiceActionPayload, { ok?: boolean; state?: OrchestratorServiceState }>(
    'service.action',
    { payload, targetAgent }
  );

export const listContainers = (
  payload: { managedOnly?: boolean; service?: string; search?: string },
  targetAgent?: string
) =>
  requestOrchestrator<
    { managedOnly?: boolean; service?: string; search?: string },
    { ok?: boolean; managedOnly?: boolean; total?: number; containers?: Array<Record<string, unknown>> }
  >('container.list', { payload, targetAgent });

export const inspectContainer = (payload: { containerName: string }, targetAgent?: string) =>
  requestOrchestrator<{ containerName: string }, { ok?: boolean; containerName?: string; inspect?: Record<string, unknown> }>(
    'container.inspect',
    { payload, targetAgent }
  );

export const getContainerLogs = (
  payload: { containerName: string; tail?: number; since?: number },
  targetAgent?: string
) =>
  requestOrchestrator<
    { containerName: string; tail?: number; since?: number },
    { ok?: boolean; containerName?: string; tail?: number; logs?: string }
  >('container.logs', { payload, targetAgent });

export const createContainer = (payload: ContainerCreatePayload, targetAgent?: string) =>
  requestOrchestrator<
    ContainerCreatePayload,
    { ok?: boolean; containerName?: string; created?: boolean; running?: boolean }
  >('container.create', { payload, targetAgent });

export const applyContainerAction = (payload: ContainerActionPayload, targetAgent?: string) =>
  requestOrchestrator<
    ContainerActionPayload,
    {
      ok?: boolean;
      containerName?: string;
      action?: string;
      exists?: boolean;
      running?: boolean;
      removed?: boolean;
      existed?: boolean;
    }
  >('container.action', { payload, targetAgent });
