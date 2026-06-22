#!/usr/bin/env bash

set -euo pipefail

CURRENT_USER="${SUDO_USER:-$USER}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()  { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo: sudo bash setup.sh"

# 0. Minimal config
log "Configure deployment"
echo ""

read -rp "  Repo SSH URL [git@github.com:trisapple/FlagSync.git]: " REPO_SSH_URL
REPO_SSH_URL="${REPO_SSH_URL:-git@github.com:trisapple/FlagSync.git}"

DEFAULT_CLONE_DIR="$(pwd)/flagsync"
read -rp "  Clone directory [$DEFAULT_CLONE_DIR]: " CLONE_DIR
CLONE_DIR="${CLONE_DIR:-$DEFAULT_CLONE_DIR}"

echo ""

# 1. GitHub deploy key
log "Setting up GitHub deploy key..."

DEPLOY_USER_HOME=$(getent passwd "$CURRENT_USER" | cut -d: -f6)
SSH_DIR="$DEPLOY_USER_HOME/.ssh"
KEY_PATH="$SSH_DIR/flagsync_deploy"

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [[ ! -f "$KEY_PATH" ]]; then
    sudo -u "$CURRENT_USER" ssh-keygen -t ed25519 -C "flagsync-deploy" -f "$KEY_PATH" -N ""
    log "Generated deploy key at $KEY_PATH"
else
    log "Deploy key already exists at $KEY_PATH — skipping generation"
fi

SSH_CONFIG="$SSH_DIR/config"
if ! grep -q "flagsync_deploy" "$SSH_CONFIG" 2>/dev/null; then
    cat >> "$SSH_CONFIG" <<SSHCONF

Host github.com
    HostName github.com
    User git
    IdentityFile $KEY_PATH
    IdentitiesOnly yes
SSHCONF
    chmod 600 "$SSH_CONFIG"
    chown "$CURRENT_USER:$CURRENT_USER" "$SSH_CONFIG"
fi

chown "$CURRENT_USER:$CURRENT_USER" "$KEY_PATH" "$KEY_PATH.pub"
chmod 600 "$KEY_PATH"
chmod 644 "$KEY_PATH.pub"

log "Testing SSH connection to GitHub..."
_ssh_check() { sudo -u "$CURRENT_USER" ssh -T -o StrictHostKeyChecking=accept-new git@github.com 2>&1 || true; }
if _ssh_check | grep -q "successfully authenticated"; then
    log "GitHub SSH connection OK — deploy key already registered"
else
    echo ""
    echo "  Add this public key to GitHub as a Deploy Key:"
    echo "  Repo → Settings → Deploy keys → Add deploy key"
    echo "  (read-only access is sufficient)"
    echo ""
    cat "$KEY_PATH.pub"
    echo ""
    read -rp "  Press Enter once you have added the deploy key to GitHub..."

    if _ssh_check | grep -q "successfully authenticated"; then
        log "GitHub SSH connection OK"
    else
        warn "Could not verify GitHub SSH connection — check that the deploy key was saved correctly"
    fi
fi

echo ""

# 2. Clone repository
DEPLOY_BRANCH="feature/aws-ec2-cd-pipeline"
log "Cloning repository (branch: $DEPLOY_BRANCH)..."
if [[ -d "$CLONE_DIR/.git" ]]; then
    log "Repo already exists at $CLONE_DIR — pulling latest"
    sudo -u "$CURRENT_USER" git -C "$CLONE_DIR" fetch origin
    sudo -u "$CURRENT_USER" git -C "$CLONE_DIR" checkout "$DEPLOY_BRANCH"
    sudo -u "$CURRENT_USER" git -C "$CLONE_DIR" reset --hard "origin/$DEPLOY_BRANCH"
else
    sudo -u "$CURRENT_USER" git clone --branch "$DEPLOY_BRANCH" "$REPO_SSH_URL" "$CLONE_DIR"
    log "Cloned to $CLONE_DIR"
fi

PROJECT_ROOT="$CLONE_DIR"

echo ""

# 3. Load .env config — prefer files already on disk, else wait for scp, else prompt
BACKEND_ENV="$PROJECT_ROOT/backend/.env"
FRONTEND_ENV="$PROJECT_ROOT/frontend/.env"

if [[ ! -f "$BACKEND_ENV" && ! -f "$FRONTEND_ENV" ]]; then
    SERVER_IP=$(hostname -I | awk '{print $1}')
    warn "No .env files found in $PROJECT_ROOT"
    echo ""
    echo "  Copy your .env files now from another terminal:"
    echo "    scp backend.env $CURRENT_USER@$SERVER_IP:$BACKEND_ENV"
    echo "    scp frontend.env $CURRENT_USER@$SERVER_IP:$FRONTEND_ENV"
    echo ""
    read -rp "  Press Enter when done (leave files missing to enter credentials manually)..."
    echo ""
fi

# Backend config
if [[ -f "$BACKEND_ENV" ]]; then
    log "Loading database config from $BACKEND_ENV"
    set -a; source "$BACKEND_ENV"; set +a
    [[ -n "${DB_PASSWORD:-}" ]] || die "DB_PASSWORD is not set in $BACKEND_ENV"
elif [[ -f "$(pwd)/backend.env" ]]; then
    log "Loading database config from ./backend.env"
    set -a; source "$(pwd)/backend.env"; set +a
    [[ -n "${DB_PASSWORD:-}" ]] || die "DB_PASSWORD is not set in ./backend.env"
else
    warn "Entering database credentials manually"
    echo ""
    read -rp "  DB host: " DB_HOST
    [[ -n "$DB_HOST" ]] || die "DB host cannot be empty"
    read -rp "  DB port: " DB_PORT
    [[ -n "$DB_PORT" ]] || die "DB port cannot be empty"
    read -rp "  DB name: " DB_NAME
    [[ -n "$DB_NAME" ]] || die "DB name cannot be empty"
    read -rp "  DB user: " DB_USER
    [[ -n "$DB_USER" ]] || die "DB user cannot be empty"
    read -rsp "  DB password: " DB_PASSWORD; echo
    [[ -n "$DB_PASSWORD" ]] || die "DB password cannot be empty"
fi

echo ""

# Frontend config
if [[ -f "$FRONTEND_ENV" ]]; then
    log "Loading frontend config from $FRONTEND_ENV"
    set -a; source "$FRONTEND_ENV"; set +a
    SERVER_HOST=$(echo "${VITE_API_BASE_URL:-}" | sed -E 's|https?://([^/]+).*|\1|')
    [[ -n "$SERVER_HOST" ]] || die "Could not parse host from VITE_API_BASE_URL in $FRONTEND_ENV"
elif [[ -f "$(pwd)/frontend.env" ]]; then
    log "Loading frontend config from ./frontend.env"
    set -a; source "$(pwd)/frontend.env"; set +a
    SERVER_HOST=$(echo "${VITE_API_BASE_URL:-}" | sed -E 's|https?://([^/]+).*|\1|')
    [[ -n "$SERVER_HOST" ]] || die "Could not parse host from VITE_API_BASE_URL in ./frontend.env"
else
    warn "No frontend/.env found — enter server details"
    echo ""
    DETECTED_IP=$(hostname -I | awk '{print $1}')
    read -rp "  Server hostname or IP [$DETECTED_IP]: " SERVER_HOST
    SERVER_HOST="${SERVER_HOST:-$DETECTED_IP}"
fi

echo ""

# Write .env files if not already present
if [[ ! -f "$BACKEND_ENV" ]]; then
    cat > "$BACKEND_ENV" <<EOF
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
EOF
    log "Created backend/.env"
fi

if [[ ! -f "$FRONTEND_ENV" ]]; then
    cat > "$FRONTEND_ENV" <<EOF
VITE_API_BASE_URL=http://$SERVER_HOST/api
EOF
    log "Created frontend/.env"
fi

echo ""

# 4. System packages
log "Installing system packages..."
apt-get update -q
apt-get install -y -q \
    curl nginx \
    libpq-dev build-essential \
    python3.12 python3.12-venv python3.12-dev

if ! command -v node &>/dev/null \
        || [[ "$(node --version | cut -dv -f2 | cut -d. -f1)" -lt 22 ]]; then
    log "Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -q nodejs
fi

# 5. Backend
log "Setting up backend..."
cd "$PROJECT_ROOT/backend"

python3.12 -m venv .venv
source .venv/bin/activate
pip install --quiet -r requirements.txt

log "Creating database tables..."
python3.12 -c "
import app.models.role
from app.database import Base, engine
Base.metadata.create_all(bind=engine)
"
deactivate

# 6. Frontend build
log "Building frontend..."
cd "$PROJECT_ROOT/frontend"
npm ci --silent
npm run build
chown -R "$CURRENT_USER:$CURRENT_USER" "$PROJECT_ROOT/frontend/dist"
log "Frontend built → frontend/dist/"

# 7. nginx
log "Configuring nginx..."

OWNER_HOME=$(getent passwd "$CURRENT_USER" | cut -d: -f6)
if [[ -n "$OWNER_HOME" && "$OWNER_HOME" != "/" && "$PROJECT_ROOT" == "$OWNER_HOME"* ]]; then
    chmod o+x "$OWNER_HOME"
fi

cat > /etc/nginx/sites-available/flagsync <<NGINXCONF
server {
    listen 80;
    server_name $SERVER_HOST;

    root $PROJECT_ROOT/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/flagsync /etc/nginx/sites-enabled/flagsync
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable --now nginx
systemctl reload nginx

# 8. Backend systemd service
VENV_BIN="$PROJECT_ROOT/backend/.venv/bin"

log "Installing flagsync-backend systemd service..."

cat > /etc/systemd/system/flagsync-backend.service <<EOF
[Unit]
Description=FlagSync Backend (FastAPI/uvicorn)
After=network.target

[Service]
User=$CURRENT_USER
WorkingDirectory=$PROJECT_ROOT/backend
EnvironmentFile=$PROJECT_ROOT/backend/.env
ExecStart=$VENV_BIN/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now flagsync-backend.service

log ""
log "Setup complete!"
log ""
log "  App: http://$SERVER_HOST"
log "  API: http://$SERVER_HOST/api/health"
log ""
log "Service commands:"
log "  sudo systemctl status flagsync-backend"
log "  sudo journalctl -u flagsync-backend -f"
log ""
log "To redeploy after an update:"
log "  cd $PROJECT_ROOT && git pull"
log "  cd frontend && npm ci && npm run build"
log "  sudo systemctl restart flagsync-backend"
