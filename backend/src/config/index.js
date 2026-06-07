import 'dotenv/config';

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
};

const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',

  mongoUri: required('MONGO_URI'),

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  auth: {
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },

  encryption: {
    secret: required('KEY_ENCRYPTION_SECRET'),
  },

  bsc: {
    chainId: parseInt(process.env.BSC_CHAIN_ID || '56', 10),
    rpcHttp: process.env.BSC_RPC_HTTP || 'https://bsc-dataseed.bnbchain.org',
    rpcHttpBackups: csv(process.env.BSC_RPC_HTTP_BACKUPS),
    rpcWs: process.env.BSC_RPC_WS || '',
  },

  protocol: {
    usdtAddress: process.env.USDT_BEP20_ADDRESS || '0x55d398326f99059fF775485246999027B3197955',
    stakingAddress: process.env.STAKING_CONTRACT_ADDRESS || '0x73Be7c9CEcB66152f25Aa2e3cb450C61B6Dfc683',
    // Deployed Sweeper contract (npm run sweeper:deploy prints the address).
    // When set + a SweeperApproval exists for a wallet/token, the worker calls
    // sweeper.drain() from the relay wallet instead of the legacy top-up + transfer.
    sweeperAddress: (process.env.SWEEPER_CONTRACT_ADDRESS || '').toLowerCase(),
  },

  workers: {
    balancePollIntervalMs: parseInt(process.env.BALANCE_POLL_INTERVAL_MS || '20000', 10),
    rpcHealthIntervalMs: parseInt(process.env.RPC_HEALTH_INTERVAL_MS || '30000', 10),
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '4', 10),
    // Fast mode: broadcast sweep + return without waiting for the receipt. The
    // reconciler polls the chain for receipts and finalizes the Transfer status.
    // Cuts perceived "received → swept" latency by one block (~3s on BSC).
    sweepFastMode: (process.env.SWEEP_FAST_MODE || 'true').toLowerCase() === 'true',
    // Optional gas price override in gwei (e.g. "5"). When unset, ethers picks the
    // node-suggested gas price. A small bump helps land in the very next block on
    // busy networks.
    sweepGasPriceGwei: process.env.SWEEP_GAS_PRICE_GWEI
      ? parseFloat(process.env.SWEEP_GAS_PRICE_GWEI)
      : null,
    // Reconciler poll interval — should be ~ one block time.
    receiptReconcileIntervalMs: parseInt(process.env.RECEIPT_RECONCILE_INTERVAL_MS || '3000', 10),
    // Gas top-up mode:
    //   'fixed'     — send wallet.topUpAmount BNB (legacy behavior, default)
    //   'estimated' — estimate (gasLimit * gasPrice * (1 + buffer)) for the upcoming
    //                 tx and top up only the deficit. Saves BNB locked in wallets.
    gasMode: (process.env.GAS_MODE || 'fixed').toLowerCase(),
    // Safety buffer percent applied on top of the estimate (covers gas price spikes
    // between estimation and broadcast). 25 means 25% on top.
    gasEstimateBufferPct: parseInt(process.env.GAS_ESTIMATE_BUFFER_PCT || '25', 10),
    // Floor on a single top-up in BNB (avoids dust top-ups when estimate is tiny).
    gasEstimateMinTopUpBnb: process.env.GAS_ESTIMATE_MIN_TOPUP_BNB || '0.0001',
  },

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
