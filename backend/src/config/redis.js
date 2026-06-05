import IORedis from 'ioredis';
import { config } from './index.js';

export function createRedisConnection(options = {}) {
  return new IORedis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...options,
  });
}
