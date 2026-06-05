import { connectDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { startTokenSweepWorker } from './tokenSweepWorker.js';
import { startStakingWorker } from './stakingWorker.js';
import { startEventListener } from './eventListener.js';
import { startBalancePolling } from './balancePollingWorker.js';
import { startRpcHealthWorker } from './rpcHealthWorker.js';

async function main() {
  await connectDb();
  logger.info('Workers starting…');

  const tokenSweep = startTokenSweepWorker();
  const staking = startStakingWorker();
  const eventListener = await startEventListener();
  const polling = startBalancePolling();
  const rpcHealth = startRpcHealthWorker();

  logger.info('All workers running');

  const shutdown = async (sig) => {
    logger.info({ sig }, 'Shutting down workers');
    await Promise.allSettled([
      tokenSweep.close(),
      staking.close(),
      eventListener?.stop?.(),
      polling.stop(),
      rpcHealth.stop(),
    ]);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Worker bootstrap failed');
  process.exit(1);
});
