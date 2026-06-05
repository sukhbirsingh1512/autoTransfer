import { MonitoringWallet } from '../models/MonitoringWallet.js';
import { Token } from '../models/Token.js';
import { balanceOf } from '../services/blockchain/token.js';
import { enqueueTokenSweep } from '../queues/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Backup polling: walks active wallets x active tokens and enqueues a sweep
 * whenever there's an unswept balance. Acts as a safety net for missed WS events.
 */
export function startBalancePolling() {
  const interval = setInterval(async () => {
    try {
      const [wallets, tokens] = await Promise.all([
        MonitoringWallet.find({ status: 'ACTIVE', walletMode: 'ACTIVE_MONITORING' }).lean(),
        Token.find({ status: 'ACTIVE' }).lean(),
      ]);
      for (const wallet of wallets) {
        for (const token of tokens) {
          try {
            const bal = await balanceOf(token.contractAddress, wallet.walletAddress);
            if (bal > 0n) {
              await enqueueTokenSweep({
                monitoringWalletAddress: wallet.walletAddress,
                tokenContractAddress: token.contractAddress,
                incomingTxHash: null,
                rawAmount: bal.toString(),
              });
            }
          } catch (err) {
            logger.warn({ err: err.message, wallet: wallet.walletAddress, token: token.contractAddress }, 'Polling balance check failed');
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Balance polling failed');
    }
  }, config.workers.balancePollIntervalMs);

  return { stop: () => clearInterval(interval) };
}
