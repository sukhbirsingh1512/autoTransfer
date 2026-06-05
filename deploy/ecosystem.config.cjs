// PM2 ecosystem for the FundsTransfer admin platform.
// Runs the Express API and the BullMQ workers as two long-lived processes.
//
// Notes:
// - One workers process per signing key — DO NOT scale workers > 1 with
//   the current in-memory nonce manager (it would race on the same wallets).
// - The API can be safely scaled (cluster mode) since it doesn't sign txs.
//
// Usage:
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save
//   pm2 startup           # (already run by deploy.sh)

const path = require('path');
const cwd = path.join(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'fundsTransfer-api',
      cwd: path.join(cwd, 'backend'),
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
      error_file: '/var/log/fundsTransfer/api.err.log',
      out_file: '/var/log/fundsTransfer/api.out.log',
      time: true,
    },
    {
      name: 'fundsTransfer-workers',
      cwd: path.join(cwd, 'backend'),
      script: 'src/workers/runWorkers.js',
      instances: 1, // see note above
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '600M',
      env: { NODE_ENV: 'production' },
      error_file: '/var/log/fundsTransfer/workers.err.log',
      out_file: '/var/log/fundsTransfer/workers.out.log',
      time: true,
    },
  ],
};
