import { ethers } from 'ethers';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

const HTTP_ENDPOINTS = [config.bsc.rpcHttp, ...config.bsc.rpcHttpBackups];
const NETWORK = { name: 'bnb', chainId: config.bsc.chainId };

let httpProvider;
let wsProvider;
let wsRefCount = 0;

function buildFallbackProvider() {
  if (HTTP_ENDPOINTS.length === 1) {
    return new ethers.JsonRpcProvider(HTTP_ENDPOINTS[0], NETWORK, { staticNetwork: true });
  }
  const providers = HTTP_ENDPOINTS.map((url, i) => ({
    provider: new ethers.JsonRpcProvider(url, NETWORK, { staticNetwork: true }),
    priority: i + 1,
    stallTimeout: 2000,
    weight: 1,
  }));
  return new ethers.FallbackProvider(providers, NETWORK, { quorum: 1 });
}

export function getHttpProvider() {
  if (!httpProvider) httpProvider = buildFallbackProvider();
  return httpProvider;
}

export function getWsProvider() {
  if (!config.bsc.rpcWs) return null;
  if (!wsProvider) {
    wsProvider = new ethers.WebSocketProvider(config.bsc.rpcWs, NETWORK);
    wsProvider.websocket.addEventListener?.('close', () => {
      logger.warn('WS provider closed; will lazily reconnect on next use');
      wsProvider = null;
    });
  }
  wsRefCount++;
  return wsProvider;
}

export async function pingProviders() {
  const results = await Promise.allSettled(
    HTTP_ENDPOINTS.map(async (url) => {
      const p = new ethers.JsonRpcProvider(url, NETWORK, { staticNetwork: true });
      const block = await p.getBlockNumber();
      await p.destroy();
      return { url, block };
    })
  );
  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? { url: HTTP_ENDPOINTS[i], healthy: true, blockNumber: r.value.block }
      : { url: HTTP_ENDPOINTS[i], healthy: false, error: r.reason?.message || 'unknown' }
  );
}

export function walletFromKey(privateKey) {
  const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  return new ethers.Wallet(pk, getHttpProvider());
}
