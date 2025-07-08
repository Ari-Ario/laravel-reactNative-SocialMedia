## Showing laravel.Log
tail -f storage/logs/laravel.log


## seeding

php artisan make:command RefreshStories
or by Table-name
php artisan db:seed --class=StoriesTableSeeder