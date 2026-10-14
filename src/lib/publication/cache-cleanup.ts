import redis from '../redis';
import { logger } from '../logger';

export async function cleanupPublicationCache(keys: Set<string>): Promise<boolean> {
  if (!keys.size) return false;
  try { await redis.del(...keys); return false; }
  catch {
    await logger.warn({ source: 'publication', message: 'Publication committed; old cache cleanup pending' });
    return true;
  }
}
