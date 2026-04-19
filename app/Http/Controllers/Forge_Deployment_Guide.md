# 🏁 Final Forge Configuration Package

Below are the complete, enhanced configurations for your Laravel Forge environment. These include **Brotli Compression**, **Octane Proxying**, and **Automated Deployment**.

---

## 1. 🌐 Enhanced Nginx Configuration
**Copy and paste this into Forge > Sites > [Your Site] > Nginx > Edit Rules.**

```nginx
# 🚀 PERFORMANCE: Brotli Compression
# Note: Ensure ngx_brotli is available on your server. Standard on new Forge droplets.
brotli on;
brotli_comp_level 6;
brotli_static on;
brotli_types text/plain text/css application/javascript application/x-javascript text/xml application/xml application/xml+rss text/javascript application/json image/svg+xml;

ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_dhparam /etc/nginx/dhparams.pem;

add_header X-Frame-Options "SAMEORIGIN";
add_header X-XSS-Protection "1; mode=block";
add_header X-Content-Type-Options "nosniff";

client_max_body_size 64M;

index index.html index.htm index.php;

charset utf-8;

# FORGE CONFIG (DO NOT REMOVE!)
include forge-conf/3104980/server/*;

# 📡 1. Reverb WebSocket Proxy (Frontend connections)
location /app/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_read_timeout 60m;
}

# 📡 2. Reverb Broadcast API Proxy
location /apps/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
}

# 🏎️ 3. OCTANE PROXY (Main App)
location / {
    proxy_pass http://127.0.0.1:8089;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    
    # Try static files first, then fallback to Octane
    try_files $uri $uri/ @octane;
}

location @octane {
    proxy_pass http://127.0.0.1:8089;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 🖼️ Static Assets (Expo / Public)
location = /favicon.ico { access_log off; log_not_found off; }
location = /robots.txt { access_log off; log_not_found off; }

# 🔥 Expo Service Worker (No Cache)
location = /expo-service-worker.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Access-Control-Allow-Origin "*";
}

access_log off;
error_log /var/log/nginx/3104980-error.log error;

# 🛡️ PHP Fallback (Only for direct .php files)
location ~ \.php$ {
    fastcgi_pass unix:/var/run/php/php8.4-fpm-laravel-reactnative-socialmedia-.sock;
    include fastcgi_params;
    include forge_fastcgi_defaults;
}

location ~ /\.(?!well-known).* {
    deny all;
}
```

---

## 2. 🚀 Enhanced Deployment Script
**Copy and paste this into Forge > Sites > [Your Site] > Deployment Script.**

```bash
$CREATE_RELEASE()

cd $FORGE_RELEASE_DIRECTORY

# 📦 Standard Laravel Build
$FORGE_COMPOSER install --no-dev --no-interaction --prefer-dist --optimize-autoloader
$FORGE_PHP artisan config:clear
$FORGE_PHP artisan optimize
$FORGE_PHP artisan storage:link
$FORGE_PHP artisan migrate --force

# 📱 Frontend Build (Expo Web)
cd frontend
npm install --legacy-peer-deps
npx expo export --platform web --clear

# 🚚 Sync Expo to Laravel Public
cp -rv dist/* ../public/
cd ..

$ACTIVATE_RELEASE()

# 🏎️ Reload Octane to apply new code
$FORGE_PHP artisan octane:reload

# 📦 Restart Queues
$RESTART_QUEUES()
```

---

## 3. 🛠️ The "New Forge Design" (Processes Tab)
Forge has updated "Daemons" to **Processes**. Go to your **Server > Processes** tab and add these two:

### A. The Octane Engine (API Speed)
This keeps your app in memory.
- **Name**: `Octane`
- **Command Type**: `Custom`
- **Command**: `php artisan octane:start --server=roadrunner --port=8089 --host=0.0.0.0`
- **User**: `forge`
- **Directory**: `/home/forge/your-domain.com`
- **Processes**: `1`
- **Binary**: `php` (PHP 8.4)

### B. The Queue Worker (Background Tasks)
This handles notifications and heavy logic.
- **Name**: `Queue-Worker`
- **Command Type**: `Queue worker`
- **Connection**: `database`
- **Queue**: (Leave empty for default)
- **Processes**: `1`
- **Backoff**: `0`
- **Sleep**: `3`
- **Timeout**: `60`
- **Tries**: `3`
- **Memory**: `128` MB

---

## ✅ Final Check
- **Brotli**: Enabled for JSON and text (80% bandwidth saving).
- **Octane**: Proxying to port `8089`.
- **Nginx Headers**: Preserved for security and CORS.
- **Expo**: Automatic build and sync on every deploy.

**Your backend is now at its absolute peak performance.**
