#!/bin/bash
set -e

echo "🚀 Starting installation for video widget backend + frontend..."

### --- UPDATE SYSTEM ---
apt update -y
apt upgrade -y

### --- INSTALL NODE.JS 22 LTS ---
echo "📦 Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs build-essential

### --- INSTALL PM2 ---
echo "📦 Installing PM2..."
npm install -g pm2

### --- INSTALL NGINX ---
echo "📦 Installing Nginx..."
apt install -y nginx

### --- CLONE YOUR REPOSITORY ---
echo "📦 Cloning GitHub repo..."
rm -rf /opt/video-widget
git clone https://github.com/pavelboychenko/video_widget.git /opt/video-widget

### --- INSTALL BACKEND DEPENDENCIES ---
echo "📦 Installing backend dependencies..."
cd /opt/video-widget/backend
npm install

### --- CREATE ENV FILE ---
echo "🛠 Creating .env file..."

cat > /opt/video-widget/backend/.env <<EOF
OPENAI_API_KEY=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
PORT=3000
NODE_ENV=production
EOF

echo "⚠️ IMPORTANT: Replace OPENAI_API_KEY in /opt/video-widget/backend/.env"

### --- START BACKEND WITH PM2 ---
echo "🚀 Starting backend with PM2..."
pm2 start server.js --name video-widget --time
pm2 save

### --- CONFIGURE NGINX ---
echo "🛠 Configuring Nginx..."

cat > /etc/nginx/sites-available/ai-studia.ru <<EOF
server {
    listen 80;
    server_name ai-studia.ru www.ai-studia.ru;
    return 301 https://ai-studia.ru\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ai-studia.ru www.ai-studia.ru;

    ssl_certificate /etc/letsencrypt/live/ai-studia.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ai-studia.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /opt/video-widget;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/ai-studia.ru /etc/nginx/sites-enabled/ai-studia.ru

nginx -t
systemctl reload nginx

echo "🎉 Installation finished!"
echo "➡ Now edit /opt/video-widget/backend/.env and insert your OPENAI_API_KEY"
echo "➡ Then restart backend: pm2 restart video-widget"
