A social-media application with a tailored chatbot
some simillarities with Telegram, Whatsapp and instargram (a collection of some of their features with a simple design)

Chatbot-training must be done by employees, although it learnes from media gradually!
## Go to frontend to setup React-Native

## Go to backend to setup laravel


## important commands:
php artisan optimize:clear  #most important
php artisan config:clear    # Konfiguration (.env & config/*.php)
php artisan route:clear     # Routen
php artisan view:clear      # Blade-Templates
php artisan cache:clear     # App-Daten-Cache
php artisan event:clear     # Event-Listener
php artisan serve --host 0.0.0.0

php artisan reverb:start --debug

or deepclean:
php artisan optimize:clear && php artisan event:clear && composer dump-autoload

## for notification and HTTPS requests
npx expo start --tunnel


CHROME_PATH=$(which google-chrome || which google-chrome-stable) npx expo start

if above command does not work, try this:
Start Expo with the following flag to prevent it from trying to launch the standalone DevTools:

and for android device:
npx expo start --no-dev-session

Debug in your browser:
Once the app is running, press j in your terminal.
This will open the debugger in a standard Chrome/Chromium tab, which avoids the path-space bug entirely. 
Why Option 2 (AppArmor) is likely needed
If you are on Ubuntu 24.04 or newer, the Invalid argument (22) part of the error is a known conflict with new security restrictions on "unprivileged user namespaces". If the above doesn't work, run this command to relax that restriction for your session: 

sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
