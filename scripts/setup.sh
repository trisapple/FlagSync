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

# Collect config
log "Configure deployment"
echo ""

read -rp "  Repo SSH URL [git@github.com:trisapple/FlagSync.git]: " REPO_SSH_URL
REPO_SSH_URL="${REPO_SSH_URL:-git@github.com:trisapple/FlagSync.git}"

DEFAULT_CLONE_DIR="$(pwd)/flagsync"
read -rp "  Clone directory [$DEFAULT_CLONE_DIR]: " CLONE_DIR
CLONE_DIR="${CLONE_DIR:-$DEFAULT_CLONE_DIR}"

read -rp "  DB name     [flagsync]: " DB_NAME;   DB_NAME="${DB_NAME:-flagsync}"
read -rp "  DB user     [flagsync]: " DB_USER;   DB_USER="${DB_USER:-flagsync}"
read -rsp "  DB password: " DB_PASSWORD; echo
[[ -n "$DB_PASSWORD" ]] || die "DB password cannot be empty"

echo ""
DETECTED_IP=$(hostname -I | awk '{print $1}')
read -rp "  Server hostname or IP [$DETECTED_IP]: " SERVER_HOST
SERVER_HOST="${SERVER_HOST:-$DETECTED_IP}"

echo ""

# 0. GitHub deploy key
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

# Write SSH config so git uses this key for github.com
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

# 1. Clone repository
DEPLOY_BRANCH="develop-tristan"
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

# 2. System packages
log "Installing system packages..."
apt-get update -q
apt-get install -y -q \
    curl nginx \
    postgresql postgresql-contrib \
    libpq-dev build-essential \
    python3.12 python3.12-venv python3.12-dev

if ! command -v node &>/dev/null \
        || [[ "$(node --version | cut -dv -f2 | cut -d. -f1)" -lt 22 ]]; then
    log "Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -q nodejs
fi

# 3. PostgreSQL
log "Setting up PostgreSQL..."
systemctl enable --now postgresql

sudo -u postgres psql -c \
    "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null \
    || sudo -u postgres psql -c \
    "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"

sudo -u postgres psql -c \
    "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null \
    || warn "Database '$DB_NAME' already exists — skipping"

# 4. Backend
log "Setting up backend..."
cd "$PROJECT_ROOT/backend"

python3.12 -m venv .venv
source .venv/bin/activate
pip install --quiet -r requirements.txt

cat > "$PROJECT_ROOT/backend/.env" <<EOF
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
EOF
log "Created backend/.env"

log "Creating database tables..."
DB_USER=$DB_USER DB_PASSWORD=$DB_PASSWORD DB_HOST=localhost DB_PORT=5432 DB_NAME=$DB_NAME \
    python3.12 -c "
import app.models.role
from app.database import Base, engine
Base.metadata.create_all(bind=engine)
"
deactivate

# 5. Frontend build
log "Building frontend..."
cd "$PROJECT_ROOT/frontend"
npm ci --silent

# nginx reverse-proxies both on port 80, so /api works as a relative base URL.
cat > "$PROJECT_ROOT/frontend/.env" <<EOF
VITE_API_BASE_URL=http://$SERVER_HOST/api
EOF

npm run build
chown -R "$CURRENT_USER:$CURRENT_USER" "$PROJECT_ROOT/frontend/dist"
log "Frontend built → frontend/dist/"

# 6. nginx
log "Configuring nginx..."

# o+x lets nginx (www-data) traverse the home dir without exposing listings.
OWNER_HOME=$(getent passwd "$CURRENT_USER" | cut -d: -f6)
if [[ -n "$OWNER_HOME" && "$OWNER_HOME" != "/" && "$PROJECT_ROOT" == "$OWNER_HOME"* ]]; then
    chmod o+x "$OWNER_HOME"
fi

cat > /etc/nginx/sites-available/flagsync <<NGINXCONF
server {
    listen 80;
    server_name $SERVER_HOST;

    # Serve the built React app
    root $PROJECT_ROOT/frontend/dist;
    index index.html;

    # React Router — unknown paths fall back to index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy all /api requests to uvicorn
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

# 7. Backend systemd service
VENV_BIN="$PROJECT_ROOT/backend/.venv/bin"

log "Installing flagsync-backend systemd service..."

cat > /etc/systemd/system/flagsync-backend.service <<EOF
[Unit]
Description=FlagSync Backend (FastAPI/uvicorn)
After=network.target postgresql.service
Requires=postgresql.service

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
