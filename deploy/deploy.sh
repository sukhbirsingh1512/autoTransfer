#!/usr/bin/env bash
#
# One-shot deployment script for an Ubuntu 22.04 / 24.04 server.
# Idempotent — re-running it updates the app without breaking running services.
#
# Usage (as root):
#   bash deploy/deploy.sh
#
# Required env (override defaults via shell exports before running):
#   APP_DIR         install location                (default /opt/fundsTransfer)
#   GIT_URL         git remote to clone             (default https://github.com/CHANGE_ME)
#   GIT_BRANCH      branch to deploy                (default main)
#   PUBLIC_HOST     host header for Nginx           (default _)        e.g. admin.example.com
#   SERVER_NAME     subjectAltName for cert         (default $PUBLIC_HOST)
#   BSC_CHAIN_ID    chain id                         (default 56 = mainnet)
#   USDT_ADDR       USDT BEP20 contract              (default mainnet)
#   STAKING_ADDR    staking contract                 (default mainnet)
#   EXPLORER_URL    BscScan URL                      (default https://bscscan.com)
#   NETWORK_LABEL   UI label                          (default "BSC Mainnet")
#
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

APP_DIR="${APP_DIR:-/opt/fundsTransfer}"
GIT_URL="${GIT_URL:-https://github.com/CHANGE_ME/fundsTransfer.git}"
GIT_BRANCH="${GIT_BRANCH:-main}"
PUBLIC_HOST="${PUBLIC_HOST:-_}"
BSC_CHAIN_ID="${BSC_CHAIN_ID:-56}"
USDT_ADDR="${USDT_ADDR:-0x55d398326f99059fF775485246999027B3197955}"
STAKING_ADDR="${STAKING_ADDR:-0x73Be7c9CEcB66152f25Aa2e3cb450C61B6Dfc683}"
EXPLORER_URL="${EXPLORER_URL:-https://bscscan.com}"
NETWORK_LABEL="${NETWORK_LABEL:-BSC Mainnet}"

section() { printf "\n\033[1;36m== %s ==\033[0m\n" "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

section "1. Install system packages"
apt-get update -y
apt-get install -y curl gnupg ca-certificates lsb-release ufw rsync git nginx redis-server

# Node 20 (NodeSource)
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v20'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

# MongoDB 7 (official repo)
if ! command -v mongod >/dev/null 2>&1; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc -o /usr/share/keyrings/mongodb-7.0.asc
  CODENAME="$(lsb_release -cs)"
  # MongoDB doesn't have a Noble repo yet — use Jammy on Ubuntu 24.04.
  case "$CODENAME" in
    noble) REPO_CODENAME="jammy" ;;
    *)     REPO_CODENAME="$CODENAME" ;;
  esac
  echo "deb [signed-by=/usr/share/keyrings/mongodb-7.0.asc] https://repo.mongodb.org/apt/ubuntu ${REPO_CODENAME}/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -y
  apt-get install -y mongodb-org
fi

# PM2
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

section "2. Lock infra to localhost"
# Redis: localhost only
sed -i 's/^# *bind .*/bind 127.0.0.1/' /etc/redis/redis.conf || true
sed -i 's/^bind .*/bind 127.0.0.1/'   /etc/redis/redis.conf || true
# MongoDB: localhost only (default in mongod.conf already, ensure it)
sed -i 's/^  *bindIp:.*/  bindIp: 127.0.0.1/' /etc/mongod.conf || true

systemctl enable --now redis-server
systemctl enable --now mongod
systemctl restart redis-server
systemctl restart mongod

section "3. Firewall"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

section "4. Pull code"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$GIT_BRANCH" "$GIT_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$GIT_BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$GIT_BRANCH"
fi
cd "$APP_DIR"

section "5. Backend env"
mkdir -p backend
ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  JWT_SECRET="$(node -e 'console.log(require("crypto").randomBytes(48).toString("hex"))')"
  KEY_ENCRYPTION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  cat >"$ENV_FILE" <<EOF
PORT=4000
NODE_ENV=production
LOG_LEVEL=info

MONGO_URI=mongodb://127.0.0.1:27017/fundsTransfer

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=12h

KEY_ENCRYPTION_SECRET=${KEY_ENCRYPTION_SECRET}

BSC_CHAIN_ID=${BSC_CHAIN_ID}
BSC_RPC_HTTP=https://bsc-dataseed.bnbchain.org
BSC_RPC_HTTP_BACKUPS=https://bsc-dataseed1.defibit.io,https://bsc-dataseed1.ninicoin.io
BSC_RPC_WS=wss://bsc-rpc.publicnode.com

USDT_BEP20_ADDRESS=${USDT_ADDR}
STAKING_CONTRACT_ADDRESS=${STAKING_ADDR}

BALANCE_POLL_INTERVAL_MS=20000
RPC_HEALTH_INTERVAL_MS=30000
WORKER_CONCURRENCY=4

# Fast sweep mode
SWEEP_FAST_MODE=true
RECEIPT_RECONCILE_INTERVAL_MS=3000
# Per-wallet gas mode is set on each wallet record from the admin panel; this
# is the fallback for wallets created before the field existed (legacy).
GAS_MODE=estimated
GAS_ESTIMATE_BUFFER_PCT=25
GAS_ESTIMATE_MIN_TOPUP_BNB=0.00001

CORS_ORIGIN=http://${PUBLIC_HOST}
EOF
  chmod 600 "$ENV_FILE"
  echo "Generated fresh secrets in $ENV_FILE"
else
  echo "Keeping existing $ENV_FILE (delete it to regenerate secrets)"
fi

section "6. Backend deps"
cd "$APP_DIR/backend"
npm ci --omit=dev || npm install --omit=dev

section "7. Frontend build"
cd "$APP_DIR/frontend"
# Build-time env so the bundle hits the right explorer/addresses.
cat >.env.production <<EOF
VITE_API_URL=
VITE_EXPLORER_URL=${EXPLORER_URL}
VITE_USDT_ADDRESS=${USDT_ADDR}
VITE_STAKING_ADDRESS=${STAKING_ADDR}
VITE_NETWORK_LABEL=${NETWORK_LABEL}
EOF
npm ci || npm install
npm run build

section "8. PM2 (api + workers)"
cd "$APP_DIR"
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
pm2 delete fundsTransfer-api fundsTransfer-workers 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

section "9. Nginx"
install -m 0644 "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/fundsTransfer
sed -i "s|__SERVER_NAME__|${PUBLIC_HOST}|g; s|__APP_DIR__|${APP_DIR}|g" /etc/nginx/sites-available/fundsTransfer
ln -sf /etc/nginx/sites-available/fundsTransfer /etc/nginx/sites-enabled/fundsTransfer
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

section "10. Smoke test"
sleep 2
curl -fsS http://127.0.0.1:4000/health && echo
echo "API on :4000, UI via Nginx on :80"
echo
echo "Next: seed an admin user"
echo "  cd $APP_DIR/backend && SEED_ADMIN_EMAIL=royalptk9@gmail.com SEED_ADMIN_PASSWORD='change-me' node scripts/seedDefault.js"
echo
echo "Then open http://${PUBLIC_HOST}/  and log in."
