import { ensureSchema, ensureAdminUser } from './db';
import { logger } from './logger';

const globalAny = globalThis as typeof globalThis & { __APP_INIT_PROMISE?: Promise<void> };

export const ensureAppInitialized = () => {
  if (globalAny.__APP_INIT_PROMISE) return globalAny.__APP_INIT_PROMISE;
  return (globalAny.__APP_INIT_PROMISE = (async () => {
    await ensureSchema();
    await ensureAdminUser();
    await logger.info({
      source: 'init',
      action: 'app_init',
      message: 'Application initialized',
    });
  })().catch((error) => {
    delete globalAny.__APP_INIT_PROMISE;
    throw error;
  }));
};
