# BEP20 Auto-Sweep & Staking Admin

Admin-only platform for monitoring BEP20 tokens on BNB Smart Chain, auto-sweeping
incoming tokens to secure receiving wallets, and managing USDT staking from
funded monitoring wallets.

## Layout

```
fundsTransfer/
├── backend/      Express API + BullMQ workers + Ethers.js (BSC)
└── frontend/     React + Vite + Tailwind admin panel
```

## Requirements

- Node.js 20+
- MongoDB 6+
- Redis 7+

A `docker-compose.yml` is provided for local Mongo + Redis.

## Quick start

```bash
# infra
docker compose up -d

# backend
cd backend
cp .env.example .env       # then edit values (especially KEY_ENCRYPTION_SECRET, JWT_SECRET)
npm install
npm run seed:admin         # creates the initial admin user
npm run dev                # API on :4000
npm run workers            # BullMQ workers (separate process)

# frontend
cd ../frontend
cp .env.example .env
npm install
npm run dev                # UI on :5173
```

## Network constants

- Chain: BNB Smart Chain (mainnet, chainId 56)
- USDT BEP20: `0x55d398326f99059fF775485246999027B3197955`
- Staking contract: `0x73Be7c9CEcB66152f25Aa2e3cb450C61B6Dfc683`
- Staking function: `stake(uint256 amount, address _referrer)`

## Security

- Private keys are encrypted with AES-256-GCM using `KEY_ENCRYPTION_SECRET`.
- Encrypted keys are never returned by any API.
- Decryption only happens inside workers when signing transactions.
- `KEY_ENCRYPTION_SECRET` must be a 64-char hex string (32 bytes). Generate one with:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
