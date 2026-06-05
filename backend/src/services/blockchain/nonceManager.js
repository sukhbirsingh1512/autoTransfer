import { getHttpProvider } from './provider.js';

// Per-process per-address mutex + pending nonce cache.
// In a multi-process deployment, run a single worker process per signing key
// or move this lock to Redis (e.g. SETNX with TTL).

const locks = new Map(); // address -> Promise chain tail
const pending = new Map(); // address -> next nonce to use

async function getOnchainNonce(address) {
  const provider = getHttpProvider();
  return await provider.getTransactionCount(address, 'pending');
}

export async function withNonce(address, fn) {
  const lower = address.toLowerCase();
  const prev = locks.get(lower) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => (release = resolve));
  locks.set(lower, prev.then(() => next));
  await prev;

  try {
    let nonce = pending.get(lower);
    if (nonce === undefined) {
      nonce = await getOnchainNonce(address);
    }
    try {
      const result = await fn(nonce);
      pending.set(lower, nonce + 1);
      return result;
    } catch (err) {
      // On failure refresh from chain so we don't get stuck on a stale nonce
      try {
        const fresh = await getOnchainNonce(address);
        pending.set(lower, fresh);
      } catch {
        pending.delete(lower);
      }
      throw err;
    }
  } finally {
    release();
    if (locks.get(lower) === next || locks.get(lower) === prev.then(() => next)) {
      // best-effort cleanup
    }
  }
}

export function resetNonce(address) {
  pending.delete(address.toLowerCase());
}
