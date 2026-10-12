import redis from '@/lib/redis';
import type { NextApiRequest, NextApiResponse } from 'next';

const leaseKey = (tenantId: string) => `assistant:writer:${tenantId}`;
export const activeRunKey = (tenantId: string, runId: string) => `assistant:active:${tenantId}:${runId}`;
const metaKey = (tenantId: string, runId: string) => `assistant:run:${tenantId}:${runId}:meta`;
const renewScript =
  "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('expire',KEYS[1],ARGV[2]) else return 0 end";
const releaseScript =
  "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";
export const controlError = (message: string, code: string, statusCode = 409) =>
  Object.assign(new Error(message), { code, statusCode });

export async function createAssistantRunControl(input: {
  tenantId: string;
  runId: string;
  readOnly: boolean;
  req: NextApiRequest;
  res: NextApiResponse;
}) {
  const { tenantId, runId, readOnly, req, res } = input;
  const controller = new AbortController();
  const key = leaseKey(tenantId);
  if (!readOnly && (await redis.set(key, runId, 'EX', 90, 'NX')) !== 'OK') {
    throw controlError(
      'Another assistant is changing this tenant. Wait for it to finish or stop that run.',
      'assistant-busy',
    );
  }
  try {
    await redis.set(activeRunKey(tenantId, runId), runId, 'EX', 90);
  } catch (error) {
    if (!readOnly) await redis.eval(releaseScript, 1, key, runId).catch(() => undefined);
    throw error;
  }
  let closed = false;
  const ownedKeys = new Set(readOnly ? [] : [key]);
  let checking = false;
  let ticks = 0;
  const abort = (error: Error) => {
    if (!controller.signal.aborted) controller.abort(error);
  };
  const check = async () => {
    if (closed || checking) return;
    checking = true;
    try {
      if ((await redis.hget(metaKey(tenantId, runId), 'stopRequested')) === '1') {
        abort(controlError('Assistant stopped by you.', 'assistant-stopped'));
      }
      if (!closed && ++ticks % 15 === 0) {
        const active = await redis.eval(renewScript, 1, activeRunKey(tenantId, runId), runId, '90');
        const renewed = await Promise.all(
          [...ownedKeys].map((owned) => redis.eval(renewScript, 1, owned, runId, '90')),
        );
        if (!active || renewed.some((value) => !value)) {
          abort(
            controlError(
              'Workspace ownership changed. No further changes will be applied.',
              'assistant-lease-lost',
            ),
          );
        }
      }
    } catch {
      abort(
        controlError(
          'The assistant lost its workspace connection. Reload the run to check saved changes.',
          'assistant-connection-lost',
        ),
      );
    } finally {
      checking = false;
    }
  };
  const timer = setInterval(() => void check(), 1000);
  const disconnected = () => {
    if (!closed && !res.writableEnded) {
      abort(controlError('The assistant connection was interrupted.', 'assistant-disconnected'));
    }
  };
  req.once('aborted', disconnected);
  res.once('close', disconnected);
  return {
    signal: controller.signal,
    acquireResources: async (resources: string[]) => {
      controller.signal.throwIfAborted();
      if (readOnly && resources.length)
        throw controlError('Read-only runs cannot own shared writers.', 'assistant-read-only');
      for (const resource of [...new Set(resources)].sort()) {
        if (ownedKeys.has(resource)) continue;
        if ((await redis.set(resource, runId, 'EX', 90, 'NX')) !== 'OK') {
          throw controlError(
            'Another assistant is changing this shared package. Retry when it finishes.',
            'assistant-busy',
          );
        }
        ownedKeys.add(resource);
      }
    },
    assertOwnership: async () => {
      await check();
      controller.signal.throwIfAborted();
      const owners = await Promise.all([...ownedKeys].map((owned) => redis.get(owned)));
      if (owners.some((owner) => owner !== runId)) {
        const error = controlError(
          'Workspace ownership changed. Retry from the current files.',
          'assistant-lease-lost',
        );
        abort(error);
        throw error;
      }
    },
    dispose: async () => {
      closed = true;
      clearInterval(timer);
      req.off('aborted', disconnected);
      res.off('close', disconnected);
      await redis.eval(releaseScript, 1, activeRunKey(tenantId, runId), runId).catch(() => undefined);
      await Promise.all(
        [...ownedKeys].map((owned) => redis.eval(releaseScript, 1, owned, runId).catch(() => undefined)),
      );
    },
  };
}

export const requestAssistantStop = (tenantId: string, runId: string) =>
  redis.hset(metaKey(tenantId, runId), 'stopRequested', '1');
