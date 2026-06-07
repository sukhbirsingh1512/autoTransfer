# BEP20 Auto-Sweep & Staking Admin

Admin-only platform for BNB Smart Chain that watches monitoring wallets for
incoming BEP20 transfers, sweeps them to secure receiving wallets, and runs
USDT staking from those wallets — with a **gasless single-transaction sweep
path** designed to win the race against attackers who hold the same wallet's
private key.

The two most important pieces:

- **Sweeper contract** — when a monitoring wallet pre-approves the on-chain
  Sweeper once, all later sweeps are a single transaction signed by a relay
  wallet (not the compromised one). The compromised wallet never receives BNB
  and never signs anything at sweep time. The attacker can't drain through this
  path because every entrypoint is `onlyOwner`.
- **Estimated gas mode** — when a wallet *does* need BNB for a tx (initial
  sweeper setup, staking, or fallback sweep), the worker estimates
  `gasLimit × gasPrice × buffer` and tops up only the deficit. Idle BNB locked
  in monitoring wallets stays close to zero.

---

## Layout

```
fundsTransfer/
├── backend/      Express API + BullMQ workers + Ethers.js v6
│   ├── contracts/   Sweeper.sol + compiled artifact
│   ├── scripts/     seed / build / deploy CLIs
│   └── src/         API, models, blockchain services, workers
├── frontend/     React 18 + Vite + Tailwind admin panel
└── deploy/       One-shot Ubuntu deploy script (Node 20 + Mongo + Redis +
                  Nginx + PM2), ecosystem.config.cjs, nginx.conf
```

## Requirements

- Node.js 20+
- MongoDB 6+
- Redis 7+

`docker-compose.yml` at the root starts Mongo + Redis locally.

## Quick start (local dev)

```bash
# infra
docker compose up -d

# backend
cd backend
cp .env.example .env       # fill in JWT_SECRET, KEY_ENCRYPTION_SECRET, BSC_*
npm install
npm run seed:admin         # create the initial admin user (interactive)
npm run dev                # API on :4000
npm run workers            # BullMQ workers (run in a separate terminal)

# frontend
cd ../frontend
cp .env.example .env
npm install
npm run dev                # UI on :5173
```

Default admin email/password used by the deploy script seed:
`admin@example.com` / `password123` — change immediately.

## Production deploy

One-shot script for an Ubuntu 22.04 / 24.04 server:

```bash
ssh root@your-server
GIT_URL=https://github.com/YOUR_ORG/autoTransfer.git \
PUBLIC_HOST=your.domain.tld \
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/autoTransfer/main/deploy/deploy.sh)
```

Installs Node 20, MongoDB 7, Redis, Nginx, PM2; generates fresh production
secrets; binds Mongo + Redis to `127.0.0.1`; sets up UFW; builds the frontend;
starts PM2 with both API + workers. Re-running is idempotent (pulls + restarts).
See [deploy/README.md](deploy/README.md) for variables, HTTPS via certbot, and
day-2 ops.

---

## Network constants

### Mainnet (chainId 56)

| | |
|---|---|
| HTTP RPC | `https://bsc-dataseed.bnbchain.org` |
| WS RPC | `wss://bsc-rpc.publicnode.com` |
| USDT BEP20 | `0x55d398326f99059fF775485246999027B3197955` |
| Staking contract | `0x73Be7c9CEcB66152f25Aa2e3cb450C61B6Dfc683` |
| Staking function | `stake(uint256 amount, address _referrer)` |

### Testnet (chainId 97)

| | |
|---|---|
| HTTP RPC | `https://bsc-testnet-rpc.publicnode.com` |
| WS RPC | `wss://bsc-testnet-rpc.publicnode.com` |
| Faucet | https://www.bnbchain.org/en/testnet-faucet |

Set `BSC_CHAIN_ID`, `BSC_RPC_HTTP`, `BSC_RPC_WS` and the protocol addresses in
`backend/.env`. Set `VITE_EXPLORER_URL`, `VITE_USDT_ADDRESS`,
`VITE_STAKING_ADDRESS`, `VITE_NETWORK_LABEL` in `frontend/.env` so the UI links
to the right BscScan and the network badge reads right.

---

## Gasless sweeps (Sweeper contract)

Use this if any monitoring wallet's private key is compromised.

### One-time deploy

```bash
cd backend
npm install                  # picks up solc devDependency
npm run sweeper:build        # contracts/Sweeper.json
npm run sweeper:deploy       # uses the top-priority active Master Gas Wallet as owner
# → prints "Sweeper address : 0x..."
```

Add to `backend/.env`:

```ini
SWEEPER_CONTRACT_ADDRESS=0x...
```

Restart workers (`npm run workers` or `pm2 restart fundsTransfer-workers`).

### Per-wallet setup (admin panel → Sweeper Contract → Set up approval)

For each `(monitoring wallet, token)` pair:

1. Backend estimates the wallet's BNB cost for one `approve(MAX)` call.
2. Tops up exactly that amount of BNB to the wallet (the only time we ever
   fund the compromised wallet for the sweeper path).
3. Signs `approve(sweeper, MAX_UINT256)` from the wallet, waits for receipt.
4. Saves `SweeperApproval` as `CONFIRMED`.

Every sweep afterwards is **one transaction signed by the relay wallet**:

```
relay → sweeper.drain(token, monitoringWallet, secureWallet)
        └─ transferFrom(monitoringWallet, secureWallet, balance)
```

The compromised wallet never signs and never holds BNB.

See [backend/contracts/README.md](backend/contracts/README.md) for the audit
checklist and how the contract resists the attacker.

---

## Estimated gas mode

Default for new wallets. Configured per-wallet (`gasMode: ESTIMATED`) or
globally via `GAS_MODE=estimated` in `backend/.env`.

Worker flow before any BNB-spending tx:

```
gasLimit  = provider.estimateGas({ from, to, data })
gasPrice  = provider.getFeeData().gasPrice
required  = gasLimit * gasPrice * (1 + GAS_ESTIMATE_BUFFER_PCT/100)
deficit   = max(required - currentBalance, GAS_ESTIMATE_MIN_TOPUP_BNB)
```

On a typical BSC sweep this drops the BNB locked per top-up from
`0.002 BNB → ~0.00001 BNB` (~200×). If `estimateGas` fails (e.g. staking
contract reverts because allowance isn't set yet), the worker silently falls
back to the legacy fixed-amount path.

Env knobs (defaults in `.env.example`):

| Var | Default | Note |
|---|---|---|
| `GAS_MODE` | `estimated` | Fallback for wallets without an explicit `gasMode`. |
| `GAS_ESTIMATE_BUFFER_PCT` | `25` | Safety margin for gas-price spikes. |
| `GAS_ESTIMATE_MIN_TOPUP_BNB` | `0.00001` | Floor against zero-value sends. |

---

## Fast sweep mode

When enabled (`SWEEP_FAST_MODE=true`, default in `.env.example`), the sweep
worker returns as soon as the tx is **broadcast** instead of waiting for the
receipt. A separate `receiptReconciler` polls `BROADCAST` transfers every
`RECEIPT_RECONCILE_INTERVAL_MS` (default 3 s ≈ one block) and finalizes them
to `CONFIRMED` / `FAILED`. Cuts perceived "received → swept" latency by ~one
block.

Optional: `SWEEP_GAS_PRICE_GWEI` overrides the network-suggested gas price so
sweep txs are guaranteed inclusion in the very next block — useful when racing
an attacker.

---

## Staking

Distinct from the sweep flow. Admin selects a monitoring wallet + USDT amount;
the worker drives this state machine:

```
CREATED
  → CHECKING_FUNDING_WALLET                (pick a Master Funding Wallet with USDT)
  → FUNDING_WALLET_GAS_TOP_UP_PENDING      (top up its BNB, estimated)
  → TRANSFERRING_USDT_TO_MONITORING_WALLET (funding wallet sends USDT)
  → MONITORING_WALLET_GAS_TOP_UP_PENDING   (top up monitoring wallet, estimated)
  → APPROVING_ALLOWANCE                    (approve USDT to staking contract)
  → STAKING_IN_PROGRESS                    (call stake(amount, referrer))
  → STAKING_SUCCESS
```

Referrer is **read from the staking contract** (`users(walletAddress).referrer`)
automatically — the admin doesn't type it. The Create modal shows the contract
record inline (User ID, joining time, referrer, booster flag) and disables
Create until the wallet is registered with a non-zero referrer.

Staking still requires BNB in the monitoring wallet (the staking contract checks
`msg.sender == registeredUser`); no contract-allowance trick can bypass this.

---

## Speed targets

| Scenario | Today |
|---|---|
| Sweep via Sweeper contract (recommended) | ~3–4 s total, one tx |
| Sweep via top-up + transfer, gas pre-funded | ~4–6 s, one tx |
| Sweep via top-up + transfer, cold start | ~6–10 s, two txs |
| Staking end-to-end | ~10–15 s (funding gas + USDT transfer + approve + stake) |

BSC Lorentz post-upgrade block time (~1.5 s) is the floor — actual single-tx
sweep wall-clock = `≈ one block to detect + one block to mine`.

---

## Security

- **Private keys encrypted with AES-256-GCM** using `KEY_ENCRYPTION_SECRET`.
  Encrypted keys are never returned by any API; decryption only happens inside
  worker processes when signing transactions.
- `KEY_ENCRYPTION_SECRET` must be a 64-char hex string (32 bytes). Generate:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `JWT_SECRET` rotates admin sessions when changed. The deploy script generates
  fresh values on first run.
- Mongo + Redis bound to `127.0.0.1` by the deploy script.
- UFW set to deny-by-default; only 22 / 80 / 443 open.
- Login is rate-limited (20 attempts per 15 min per IP).
- All admin write actions are logged to the `AdminLog` collection.
- For production: front the panel with a real domain + Let's Encrypt
  (`certbot --nginx`); switch SSH to keys-only.

---

## Tech stack

| Layer | |
|---|---|
| Backend runtime | Node.js 20 (ESM), Express 4 |
| Persistence | MongoDB 7 (Mongoose 8), Redis 7 (BullMQ 5 queues) |
| Blockchain | Ethers v6, FallbackProvider with HTTP failover + WS event listener |
| Frontend | React 18, Vite, Tailwind 3, React Query, React Router |
| Smart contract | Solidity 0.8.26 (`Sweeper.sol`), solc-js inline build |
| Deploy | Ubuntu 22/24 + PM2 + Nginx (see [deploy/](deploy/)) |

---

## Scripts cheat sheet

| Command (from `backend/`) | What it does |
|---|---|
| `npm run dev` | API with nodemon |
| `npm run start` | API (production) |
| `npm run workers` | BullMQ workers + event listener + reconciler + balance polling |
| `npm run workers:dev` | same with nodemon |
| `npm run seed:admin` | interactive admin seed |
| `node scripts/seedDefault.js` | non-interactive admin seed (reads `SEED_ADMIN_*` env) |
| `npm run sweeper:build` | compile `Sweeper.sol` → `contracts/Sweeper.json` |
| `npm run sweeper:deploy` | deploy Sweeper using the top-priority active gas wallet |
| `node scripts/diagnose.js` | dump wallets / tokens / balances / queue counts |
| `node scripts/resetTransfers.js` | wipe Transfer history (does not touch wallets) |
| `node scripts/repairStuck.js` | unstick wallets stuck in transient staking modes |
| `node scripts/updateAdminEmail.js` | rotate an admin's email address |

---

## Troubleshooting

| Symptom | Check |
|---|---|
| `502 Bad Gateway` from Nginx | `pm2 status` — is the API process online? |
| Workers not sweeping | `pm2 logs fundsTransfer-workers` — RPC health, wallet mode, gas balance, sweeper approval status |
| Recurring `nonce too low` | Confirm only ONE workers process runs per signing key; the in-memory nonce manager doesn't cross processes |
| Login returns 401 | Confirm an admin row exists (`mongosh fundsTransfer --eval 'db.admins.find().pretty()'`) |
| Sweep too slow | Set up Sweeper approval (single-tx path); for legacy path, set `SWEEP_GAS_PRICE_GWEI` and `SWEEP_FAST_MODE=true` |
| Wipe & start over | `mongosh fundsTransfer --eval 'db.dropDatabase()'` then re-seed |
