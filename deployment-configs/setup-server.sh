#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  Fawri.net — Full-Stack Deployment Script
#  Server:  Ubuntu 22.04 (Hostinger KVM 2)
#  Domain:  fawri.net
#  IP:      72.62.46.104
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 1: System Update & Dependencies
# ══════════════════════════════════════════════════════════════════════════════
log "Updating system packages..."
sudo apt update && sudo apt upgrade -y

log "Installing Nginx, Certbot, Git, and build tools..."
sudo apt install -y nginx certbot python3-certbot-nginx git curl build-essential

# ── Install Node.js 20 LTS via NodeSource ─────────────────────────────────────
if ! command -v node &> /dev/null; then
    log "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    log "Node.js already installed: $(node -v)"
fi

# ── Install PM2 globally ──────────────────────────────────────────────────────
if ! command -v pm2 &> /dev/null; then
    log "Installing PM2..."
    sudo npm install -g pm2
else
    log "PM2 already installed: $(pm2 -v)"
fi

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 2: Project Setup
# ══════════════════════════════════════════════════════════════════════════════
PROJECT_DIR="/var/www/fawri"

# ── Clone repository ──────────────────────────────────────────────────────────
if [ ! -d "$PROJECT_DIR" ]; then
    log "Cloning repository..."
    sudo mkdir -p /var/www
    sudo chown $USER:$USER /var/www
    # ╔══════════════════════════════════════════════════════════════════════╗
    # ║  REPLACE THIS URL WITH YOUR ACTUAL GIT REPOSITORY                  ║
    # ╚══════════════════════════════════════════════════════════════════════╝
    git clone https://github.com/ahmedhelm-y/Salla-Task-Manager.git "$PROJECT_DIR"
else
    log "Project directory exists. Pulling latest code..."
    cd "$PROJECT_DIR" && git pull origin main
fi

# ── Create logs directory ─────────────────────────────────────────────────────
mkdir -p "$PROJECT_DIR/logs"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 3: Backend — Install, Configure & Build
# ══════════════════════════════════════════════════════════════════════════════
log "Setting up Backend..."
cd "$PROJECT_DIR/backend"
npm install

# ── Create production .env ────────────────────────────────────────────────────
if [ ! -f .env ]; then
    warn "Creating backend .env from example — YOU MUST EDIT THIS!"
    cp .env.example .env
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║  IMPORTANT: Edit the backend .env file with real values:       ║"
    echo "║                                                                ║"
    echo "║  nano $PROJECT_DIR/backend/.env                    ║"
    echo "║                                                                ║"
    echo "║  Required changes:                                             ║"
    echo "║  • DATABASE_URL     → your Supabase connection string          ║"
    echo "║  • DIRECT_URL       → your Supabase direct connection          ║"
    echo "║  • JWT_SECRET       → a strong random string (64+ chars)       ║"
    echo "║  • GEMINI_API_KEY   → your Google AI API key                   ║"
    echo "║  • ENCRYPTION_KEY   → a strong 32-char key                     ║"
    echo "║  • FRONTEND_URL     → https://fawri.net                        ║"
    echo "║  • BASE_URL         → https://fawri.net                        ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
else
    log "Backend .env already exists."
fi

# ── Generate Prisma client & Build TypeScript ─────────────────────────────────
log "Generating Prisma client..."
npx prisma generate

log "Building backend TypeScript..."
npm run build

# ── Create uploads directory ──────────────────────────────────────────────────
mkdir -p "$PROJECT_DIR/backend/uploads"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 4: Frontend — Install, Configure & Build
# ══════════════════════════════════════════════════════════════════════════════
log "Setting up Frontend..."
cd "$PROJECT_DIR/frontend"
npm install

# ── Create production .env ────────────────────────────────────────────────────
if [ ! -f .env ]; then
    log "Creating frontend .env for production..."
    echo 'VITE_API_URL=https://fawri.net' > .env
else
    log "Frontend .env already exists."
fi

log "Building frontend for production..."
npm run build

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 5: Nginx Configuration
# ══════════════════════════════════════════════════════════════════════════════
log "Configuring Nginx..."

# ── Copy our config ───────────────────────────────────────────────────────────
sudo cp "$PROJECT_DIR/deployment-configs/nginx.conf" /etc/nginx/sites-available/fawri.net

# ── Enable the site ───────────────────────────────────────────────────────────
sudo ln -sf /etc/nginx/sites-available/fawri.net /etc/nginx/sites-enabled/fawri.net

# ── Remove default site ───────────────────────────────────────────────────────
sudo rm -f /etc/nginx/sites-enabled/default

# ── Test config before reload ─────────────────────────────────────────────────
# NOTE: Nginx test will fail until SSL certs exist. We'll get certs next.
# For now, temporarily use HTTP-only config for cert generation.
sudo tee /etc/nginx/sites-available/fawri-temp.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name fawri.net www.fawri.net;
    root /var/www/fawri/frontend/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
    location /uploads/ {
        alias /var/www/fawri/backend/uploads/;
        try_files $uri =404;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/fawri-temp.conf /etc/nginx/sites-enabled/fawri.net
sudo nginx -t && sudo systemctl reload nginx
log "Nginx started with temporary HTTP config."

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 6: SSL Certificate (Let's Encrypt)
# ══════════════════════════════════════════════════════════════════════════════
log "Obtaining SSL certificate with Certbot..."
echo ""
warn "Make sure your DNS A records point to 72.62.46.104 BEFORE running this!"
echo "  fawri.net     → 72.62.46.104"
echo "  www.fawri.net → 72.62.46.104"
echo ""

sudo certbot --nginx -d fawri.net -d www.fawri.net --non-interactive --agree-tos --email admin@fawri.net --redirect

# ── Now replace temp config with full production config ───────────────────────
sudo cp "$PROJECT_DIR/deployment-configs/nginx.conf" /etc/nginx/sites-available/fawri.net
sudo ln -sf /etc/nginx/sites-available/fawri.net /etc/nginx/sites-enabled/fawri.net
sudo nginx -t && sudo systemctl reload nginx
log "Nginx configured with full SSL production config."

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 7: Start Backend with PM2
# ══════════════════════════════════════════════════════════════════════════════
log "Starting backend with PM2..."
cd "$PROJECT_DIR"

# ── Copy PM2 config ───────────────────────────────────────────────────────────
cp deployment-configs/ecosystem.config.js .

# ── Start/Restart the process ─────────────────────────────────────────────────
pm2 delete fawri-backend 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# ── Set PM2 to auto-start on boot ────────────────────────────────────────────
pm2 startup systemd -u $USER --hp /home/$USER
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
pm2 save

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 8: Firewall Configuration
# ══════════════════════════════════════════════════════════════════════════════
log "Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# ══════════════════════════════════════════════════════════════════════════════
#  DONE!
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                    ║"
echo "║   🚀  DEPLOYMENT COMPLETE!                                        ║"
echo "║                                                                    ║"
echo "║   Frontend:  https://fawri.net                                     ║"
echo "║   Backend:   https://fawri.net/api/health                          ║"
echo "║   PM2 Logs:  pm2 logs fawri-backend                               ║"
echo "║   PM2 Status: pm2 status                                          ║"
echo "║                                                                    ║"
echo "║   ─────────────────────────────────────────────────────────────    ║"
echo "║   Useful Commands:                                                 ║"
echo "║   • pm2 restart fawri-backend     → Restart backend               ║"
echo "║   • pm2 logs fawri-backend        → View live logs                 ║"
echo "║   • sudo nginx -t                 → Test Nginx config              ║"
echo "║   • sudo systemctl reload nginx   → Reload Nginx                   ║"
echo "║   • sudo certbot renew --dry-run  → Test SSL auto-renewal          ║"
echo "║                                                                    ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# ── Quick-deploy script for future updates ────────────────────────────────────
cat > "$PROJECT_DIR/deploy-update.sh" << 'DEPLOY_EOF'
#!/usr/bin/env bash
# Quick re-deploy after pushing code changes
set -euo pipefail
cd /var/www/fawri
echo "📦 Pulling latest code..."
git pull origin main
echo "🔧 Building backend..."
cd backend && npm install && npx prisma generate && npm run build && cd ..
echo "🎨 Building frontend..."
cd frontend && npm install && npm run build && cd ..
echo "🔄 Restarting backend..."
pm2 restart fawri-backend
echo "✅ Deploy complete! Check: https://fawri.net"
DEPLOY_EOF
chmod +x "$PROJECT_DIR/deploy-update.sh"
log "Created quick-deploy script at $PROJECT_DIR/deploy-update.sh"
