# 🏁 Final Forge Configuration Package

Below are the complete, enhanced configurations for your Laravel Forge environment. These include **Brotli Compression**, **Octane Proxying**, and **Automated Deployment**.

---

## 1. 🌐 Enhanced Nginx Configuration
**Copy and paste this into Forge > Sites > [Your Site] > Nginx > Edit Rules.**

```nginx
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

# 🏎️ 3. API Routes - Octane (BEFORE static files)
location /api/ {
    proxy_pass http://127.0.0.1:8089;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 60m;
}

# 🏎️ 4. Laravel Web Routes - Octane (BEFORE static files)
location ~ ^/(login|register|dashboard|settings|sanctum|livewire|pulse|broadcasting|logout|forgot-password|reset-password|verify-email|confirm-password) {
    proxy_pass http://127.0.0.1:8089;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 60m;
}

# 🏎️ 5. Storage Proxy - Octane
location /storage/ {
    proxy_pass http://127.0.0.1:8089;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

# 📱 6. Expo Static Files & SPA (Catch-All)
location / {
    root /home/laravel-reactnative-socialmedia-/laravel-reactnative-socialmedia-qcx2q9ci.on-forge.com/current/public;
    try_files $uri $uri/ /index.html;
    
    # Static asset caching for performance
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}

# 🖼️ Favicon & Robots
location = /favicon.ico { 
    access_log off; 
    log_not_found off; 
    expires 30d;
}

location = /robots.txt { 
    access_log off; 
    log_not_found off; 
}

# 🔥 Expo Service Worker (No Cache)
location = /expo-service-worker.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Access-Control-Allow-Origin "*";
    expires off;
}

# 📱 Manifest & PWA files
location ~ ^/(manifest\.json|metadata\.json|sw\.js)$ {
    add_header Cache-Control "no-cache";
    add_header Service-Worker-Allowed "/";
}

# 🔒 Security - Deny hidden files
location ~ /\.(?!well-known).* {
    deny all;
}

# 🛡️ PHP Fallback (Only for direct .php files)
location ~ \.php$ {
    fastcgi_pass unix:/var/run/php/php8.4-fpm-laravel-reactnative-socialmedia-.sock;
    include fastcgi_params;
    include forge_fastcgi_defaults;
}

access_log off;
error_log /var/log/nginx/3104980-error.log error;
```

---

## 2. 🚀 Enhanced Deployment Script
**Copy and paste this into Forge > Sites > [Your Site] > Deployment Script.**

```bash
$CREATE_RELEASE()

cd $FORGE_RELEASE_DIRECTORY

# 📦 Standard Laravel Build
$FORGE_COMPOSER install --no-dev --no-interaction --prefer-dist --optimize-autoloader


# 🏎️ Main Laravel Build (Vite/Inertia)
# We missed this! This fixes the "Vite manifest not found" error.
npm install

# Redundant because of (npx expo export --platform web at the bottom
#npm run build

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

# 🏎️ Handle Octane (Reload for Swoole)
# 🏎️ Handle Octane (Reload only if running, otherwise don't crash the build)
$FORGE_PHP artisan octane:status --server=swoole > /dev/null 2>&1 && $FORGE_PHP artisan octane:reload --server=swoole || echo "Octane not running, Supervisor will handle it."


# 📦 Restart Queues
$RESTART_QUEUES()
```

---

## ⚡ Fast Backend-Only Deployment Script

If you only change PHP logic (like config files, controllers, or AI solvers) and **did not** touch the `frontend/` React Native code, use this deployment script in Forge. It skips the slow `npm` and `expo export` steps and deploys in seconds.

```bash
$CREATE_RELEASE()

cd $FORGE_RELEASE_DIRECTORY

# 📦 Standard Laravel Build (Only Backend)
$FORGE_COMPOSER install --no-dev --no-interaction --prefer-dist --optimize-autoloader

# ♻️ Clear and Cache
$FORGE_PHP artisan config:clear
$FORGE_PHP artisan optimize
$FORGE_PHP artisan storage:link

# 💾 Run new Migrations (if any)
$FORGE_PHP artisan migrate --force

# 🚚 Copy the pre-built React Native and Vite assets from the previous release to avoid rebuilding!
if [ -d "$FORGE_SITE_PATH/current/public/build" ]; then
    echo "Copying previous frontend assets..."
    cp -r $FORGE_SITE_PATH/current/public/* public/
fi

$ACTIVATE_RELEASE()

# 🏎️ Handle Octane (Reload for Swoole to pick up config/controller changes)
$FORGE_PHP artisan octane:status --server=swoole > /dev/null 2>&1 && $FORGE_PHP artisan octane:reload --server=swoole || echo "Octane not running."

# 📦 Restart Queues
$RESTART_QUEUES()
```
