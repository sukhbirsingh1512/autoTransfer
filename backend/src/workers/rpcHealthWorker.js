import { pingProviders } from '../services/blockchain/provider.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export function startRpcHealthWorker() {
  const interval = setInterval(async () => {
    try {
      const results = await pingProviders();
      const healthy = results.filter((r) => r.healthy).length;
      logger.info({ healthy, total: results.length }, 'RPC health check');
      if (healthy === 0) logger.error({ results }, 'All RPCs unhealthy');
    } catch (err) {
      logger.error({ err }, 'RPC health worker error');
    }
  }, config.workers.rpcHealthIntervalMs);
  return { stop: () => clearInterval(interval) };
}
