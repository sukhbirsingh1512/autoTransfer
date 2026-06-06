import { Transfer } from '../models/Transfer.js';
import { getHttpProvider } from '../services/blockchain/provider.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Polls BROADCAST transfers and finalizes them to CONFIRMED/FAILED once the
 * sweep tx is mined. Enables fast-mode where the worker returns after broadcast
 * without blocking on the receipt.
 *
 * Cheap to run: one getTransactionReceipt RPC per broadcasted-but-unconfirmed
 * transfer per tick (typical: 0–2 in flight at any moment).
 */
export function startReceiptReconciler() {
  const provider = getHttpProvider();
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const pending = await Transfer.find({
        status: 'BROADCAST',
        outgoingTxHash: { $exists: true, $ne: null },
      }).limit(50);

      for (const t of pending) {
        try {
          const receipt = await provider.getTransactionReceipt(t.outgoingTxHash);
          if (!receipt) continue; // not mined yet
          t.status = receipt.status === 1 ? 'CONFIRMED' : 'FAILED';
          if (t.status === 'FAILED') t.errorMessage = 'Sweep transaction reverted on-chain';
          await t.save();
          logger.info({ tx: t.outgoingTxHash, status: t.status }, 'Sweep reconciled');
        } catch (err) {
          logger.warn({ err: err.message, tx: t.outgoingTxHash }, 'Receipt poll failed');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Reconciler tick failed');
    } finally {
      running = false;
    }
  };

  const interval = setInterval(tick, config.workers.receiptReconcileIntervalMs);
  return { stop: () => clearInterval(interval) };
}
