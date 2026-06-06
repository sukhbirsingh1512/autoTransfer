import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';

const connection = createRedisConnection();

export const QUEUE_NAMES = {
  TOKEN_SWEEP: 'token-sweep',
  STAKING: 'staking',
  USDT_FUNDING: 'usdt-funding',
  STAKING_APPROVAL: 'staking-approval',
  STAKING_EXECUTION: 'staking-execution',
  BALANCE_POLL: 'balance-poll',
  RPC_HEALTH: 'rpc-health',
};

const defaultJobOptions = {
  attempts: 3,
  // Short, fixed-ish backoff. With the worker's in-flight dedup and the
  // nonceManager's internal retry, a job that still fails after this is genuinely
  // failing — don't drag retries out for 20s+.
  backoff: { type: 'fixed', delay: 1500 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 5000 },
  removeOnFail: { age: 30 * 24 * 3600 },
};

export const queues = Object.fromEntries(
  Object.entries(QUEUE_NAMES).map(([k, name]) => [
    k,
    new Queue(name, { connection, defaultJobOptions }),
  ])
);

export const sharedConnection = connection;

// BullMQ disallows ":" in custom job IDs (Redis key separator). Use "-".
const stripPrefix = (s) => (s || '').replace(/^0x/i, '');

export async function enqueueTokenSweep({ monitoringWalletAddress, tokenContractAddress, incomingTxHash, rawAmount }) {
  // Only set a dedup jobId for event-driven sweeps (where the incoming tx hash makes it
  // safe). Polling re-enqueues every tick; the worker dedupes by checking the live
  // on-chain balance and existing Transfer records — completed-job retention would
  // otherwise silently swallow every subsequent poll for the same wallet+token.
  const opts = incomingTxHash
    ? { jobId: `sweep-${stripPrefix(monitoringWalletAddress)}-${stripPrefix(tokenContractAddress)}-${stripPrefix(incomingTxHash)}` }
    : {};
  return queues.TOKEN_SWEEP.add(
    'sweep',
    { monitoringWalletAddress, tokenContractAddress, incomingTxHash, rawAmount },
    opts
  );
}

export async function enqueueTokenSweepRetry({ transferId }) {
  return queues.TOKEN_SWEEP.add('retry', { transferId, retry: true });
}

export async function enqueueStakingRequest({ stakingRequestId }) {
  return queues.STAKING.add('process', { stakingRequestId }, { jobId: `staking-${stakingRequestId}` });
}

export async function enqueueStakingRetry({ stakingRequestId }) {
  return queues.STAKING.add('retry', { stakingRequestId, retry: true });
}

export async function enqueueUsdtFundingRetry({ fundingId }) {
  return queues.USDT_FUNDING.add('retry', { fundingId });
}
