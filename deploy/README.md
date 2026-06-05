# Production deployment

One-script deploy for an Ubuntu 22.04 / 24.04 server. Installs everything,
generates fresh production secrets, builds the frontend, registers PM2 services,
and configures Nginx as a reverse proxy.

## What it installs

- Node.js 20 (NodeSource)
- MongoDB 7 (official repo)
- Redis 7 (Ubuntu repo) — bound to `127.0.0.1`
- Nginx (Ubuntu repo)
- PM2 (npm global) — managing API + workers
- UFW firewall — only ports 22, 80, 443 open

## One-time prep

1. Push this repo to a Git remote (GitHub/GitLab/Bitbucket).
2. SSH into the server as `root`.

## Run the deploy

```bash
# Replace the GIT_URL with your actual repo URL.
GIT_URL=https://github.com/YOUR_ORG/fundsTransfer.git \
PUBLIC_HOST=157.173.218.220 \
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/fundsTransfer/main/deploy/deploy.sh)
```

Or, if you've already cloned:

```bash
cd /opt/fundsTransfer
GIT_URL=https://github.com/YOUR_ORG/fundsTransfer.git \
PUBLIC_HOST=157.173.218.220 \
bash deploy/deploy.sh
```

Variables you can override on the command line:

| var | default | notes |
|---|---|---|
| `GIT_URL` | `https://github.com/CHANGE_ME/fundsTransfer.git` | **required** — your repo |
| `GIT_BRANCH` | `main` | |
| `APP_DIR` | `/opt/fundsTransfer` | |
| `PUBLIC_HOST` | `_` | server name / IP (used in CORS + Nginx `server_name`) |
| `BSC_CHAIN_ID` | `56` | use `97` for testnet |
| `USDT_ADDR` | mainnet USDT | swap for testnet |
| `STAKING_ADDR` | mainnet staking | swap for testnet |
| `EXPLORER_URL` | `https://bscscan.com` | use `https://testnet.bscscan.com` for testnet |
| `NETWORK_LABEL` | `BSC Mainnet` | |

## After it finishes

Seed the initial admin user:

```bash
cd /opt/fundsTransfer/backend
SEED_ADMIN_EMAIL=admin@yourdomain.com \
SEED_ADMIN_PASSWORD='a-strong-password' \
SEED_ADMIN_NAME='Admin' \
node scripts/seedDefault.js
```

Then open `http://YOUR_SERVER_IP/` and log in.

## Day-2 operations

```bash
# Update code + restart services
cd /opt/fundsTransfer && git pull && bash deploy/deploy.sh

# Watch logs
pm2 logs fundsTransfer-api
pm2 logs fundsTransfer-workers

# Restart only one process
pm2 restart fundsTransfer-workers

# Status of services
pm2 status
systemctl status mongod redis-server nginx
```

## Adding HTTPS (recommended)

Point a real domain at the IP, then:

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d admin.yourdomain.com
# Nginx is updated to listen on 443 with auto-renewing certs.
```

After that, also update `backend/.env`:

```ini
CORS_ORIGIN=https://admin.yourdomain.com
```

Then `pm2 restart fundsTransfer-api`.

## Security checklist

- [ ] Rotate the root password (`passwd`) — the password you shared earlier should not be reused.
- [ ] Switch SSH to keys only (`PasswordAuthentication no` in `/etc/ssh/sshd_config`).
- [ ] Take regular MongoDB backups (`mongodump`) of the `fundsTransfer` DB — losing it loses every wallet / staking record.
- [ ] Treat `backend/.env` like a private key — `KEY_ENCRYPTION_SECRET` decrypts every monitoring/gas/funding wallet private key in the DB.
- [ ] Front the panel with a real domain + Let's Encrypt before going to production.
- [ ] Consider IP-allowlisting the admin panel via Nginx (`allow … ; deny all ;`) if only specific operator IPs need access.

## Troubleshooting

| Symptom | Check |
|---|---|
| `502 Bad Gateway` from Nginx | `pm2 status` — is `fundsTransfer-api` online? Look at `/var/log/fundsTransfer/api.err.log` |
| Workers not sweeping | `pm2 logs fundsTransfer-workers` — RPC health, wallet mode, gas balance |
| `nonce too low` errors persist | Only run ONE workers process per signing key. Check `pm2 status` for duplicates. |
| Login returns 401 | Confirm seed ran; `mongosh fundsTransfer --eval 'db.admins.find().pretty()'` |
| Want to wipe and start over | `mongosh fundsTransfer --eval 'db.dropDatabase()'` then re-seed |
