#!/bin/bash
set -e

echo "======================================"
echo "🚀 VIDEO WIDGET — FULL SERVER INSTALLER"
echo "======================================"

###############################################
### 1. UPDATE SYSTEM
###############################################
apt update -y
apt upgrade -y
apt install -y git curl unzip nginx certbot python3-certbot-nginx build-essential

###############################################
### 2. INSTALL NODEJS (NVM — NO GPG PROBLEMS)
###############################################
echo "➡ Installing NodeJS via NVM (clean & safe)"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"

nvm install 22
nvm use 22

echo "Node version: $(node -v)"
echo "NPM version:  $(npm -v)"

###############################################
### 3. CLONE REPOSITORY
###############################################
cd /opt
rm -rf video_widget
git clone https://github.com/pavelboychenko/video_widget.git
cd video_widget/backend

###############################################
### 4. CREATE .ENV
###############################################
echo "➡ Creating backend .env"

cat > /opt/video_widget/backend/.env <<EOF
OPENAI_API_KEY=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
OPENAI_MODEL=gpt-4o-mini
PORT=3000
NODE_ENV=production
DB_PATH=/opt/video_widget/backend/data/widget.db
EOF

###############################################
### 5. INSTALL BACKEND DEPENDENCIES
###############################################
npm install
npm rebuild better-sqlite3 --build-from-source

mkdir -p /opt/video_widget/backend/data

###############################################
### 6. INSTALL PM2 & START BACKEND
###############################################
npm install -g pm2
pm2 stop all || true
pm2 start server.js --name video-widget
pm2 save
pm2 startup systemd -u root --hp /root

###############################################
### 7. CONFIGURE NGINX
###############################################
echo "➡ Setting up NGINX"

cat > /etc/nginx/sites-available/video-widget <<EOF
server {
    listen 80;
    server_name $1 www.$1;

    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    location / {
        return 301 https://$1\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $1 www.$1;

    root /opt/video_widget;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/$1/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$1/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/video-widget /etc/nginx/sites-enabled/video-widget

###############################################
### 8. INSTALL SSL
###############################################
systemctl restart nginx

mkdir -p /var/www/letsencrypt

echo "➡ Generating SSL certificate for domain: $1"
certbot certonly --nginx -d $1 -d www.$1 --non-interactive --agree-tos -m admin@$1 || true

systemctl restart nginx

###############################################
### 9. FINAL STATUS
###############################################
echo "======================================"
echo "🎉 INSTALLATION COMPLETE!"
echo "Domain: https://$1"
echo "Health check: https://$1/api/health"
echo "PM2 status: pm2 status"
echo "======================================"
