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