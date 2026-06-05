import { ethers } from 'ethers';
import { ERC20_ABI } from '../services/blockchain/abi.js';
import { getWsProvider, getHttpProvider } from '../services/blockchain/provider.js';
import { MonitoringWallet } from '../models/MonitoringWallet.js';
import { Token } from '../models/Token.js';
import { enqueueTokenSweep } from '../queues/index.js';
import { logger } from '../utils/logger.js';

/**
 * Subscribes to BEP20 Transfer events for every active token, and enqueues a
 * sweep whenever the receiver is one of our active monitoring wallets.
 *
 * We re-fetch active tokens + wallets every interval so admin changes are picked up
 * without a full restart.
 */
export async function startEventListener() {
  const provider = getWsProvider() || getHttpProvider();
  if (!provider) {
    logger.warn('No provider available for event listener');
    return null;
  }

  const activeContracts = new Map(); // tokenAddress -> ethers.Contract
  let activeWallets = new Set(); // lowercase addresses

  async function refresh() {
    const [tokens, wallets] = await Promise.all([
      Token.find({ status: 'ACTIVE' }).lean(),
      MonitoringWallet.find({ status: 'ACTIVE' }).lean(),
    ]);
    activeWallets = new Set(wallets.map((w) => w.walletAddress.toLowerCase()));
    const wantedTokens = new Set(tokens.map((t) => t.contractAddress.toLowerCase()));

    // Remove listeners for tokens no longer active
    for (const [addr, contract] of activeContracts) {
      if (!wantedTokens.has(addr)) {
        await contract.removeAllListeners();
        activeContracts.delete(addr);
        logger.info({ token: addr }, 'Stopped listening to token');
      }
    }
    // Add listeners for new active tokens
    for (const t of tokens) {
      const addr = t.contractAddress.toLowerCase();
      if (activeContracts.has(addr)) continue;
      const contract = new ethers.Contract(addr, ERC20_ABI, provider);
      contract.on('Transfer', async (from, to, value, eventPayload) => {
        try {
          const toLower = String(to).toLowerCase();
          if (!activeWallets.has(toLower)) return;
          await enqueueTokenSweep({
            monitoringWalletAddress: toLower,
            tokenContractAddress: addr,
            incomingTxHash: eventPayload?.log?.transactionHash,
            rawAmount: value?.toString(),
          });
        } catch (err) {
          logger.error({ err }, 'Failed to enqueue sweep from Transfer event');
        }
      });
      activeContracts.set(addr, contract);
      logger.info({ token: addr, symbol: t.tokenSymbol }, 'Listening to token Transfer events');
    }
  }

  await refresh();
  const interval = setInterval(refresh, 60_000);

  return {
    stop: async () => {
      clearInterval(interval);
      for (const c of activeContracts.values()) await c.removeAllListeners();
    },
  };
}
