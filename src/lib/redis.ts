import Redis from 'ioredis';
import { safeErrorMeta } from '@idp/shared';

const redisUrl =
  process.env.CACHE_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);
redis.on('error', (error) => console.warn('IDE Redis unavailable:', safeErrorMeta(error)));

export default redis;
