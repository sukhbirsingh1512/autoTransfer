import { getHttpProvider } from './provider.js';
import { logger } from '../../utils/logger.js';

// Per-address mutex. Within one process, only one tx from a given signing
// address is in flight at a time. Across processes, you MUST run only one
// signer process per private key — otherwise nothing can serialize them.

const locks = new Map(); // address -> Promise (tail of chain)

const MAX_RETRIES = 4;
const RETRY_BACKOFF_MS = [200, 500, 1200, 2500];

async function getOnchainNonce(address) {
  // 'pending' = highest pending-pool nonce as the RPC node sees it. Different
  // RPC nodes may have different mempool views; that's why we retry on mismatch.
  return await getHttpProvider().getTransactionCount(address, 'pending');
}

function isNonceError(err) {
  if (!err) return false;
  if (err.code === 'NONCE_EXPIRED') return true;
  const m = (err.shortMessage || err.message || '').toLowerCase();
  return m.includes('nonce too low') || m.includes('nonce has already been used') ||
         m.includes('replacement transaction underpriced');
}

export async function withNonce(address, fn) {
  const lower = address.toLowerCase();

  // Chain mutex: queue this call behind any in-flight ones for the same address.
  const prev = locks.get(lower) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => (release = resolve));
  locks.set(lower, prev.then(() => next));
  await prev;

  try {
    let lastErr;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Always fetch fresh from chain. Caching would drift when other RPC nodes'
      // mempools see our broadcast before our read-RPC does.
      const nonce = await getOnchainNonce(address);
      try {
        return await fn(nonce);
      } catch (err) {
        lastErr = err;
        if (!isNonceError(err) || attempt === MAX_RETRIES - 1) throw err;
        logger.warn(
          { address: lower, attempt, nonce, err: err.shortMessage || err.message },
          'Nonce conflict — refetching and retrying'
        );
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
      }
    }
    throw lastErr;
  } finally {
    release();
  }
}

// Kept for API compatibility; cache no longer exists so this is a no-op.
export function resetNonce(_address) {}
