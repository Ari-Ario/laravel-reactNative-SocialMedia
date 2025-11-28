## Showing laravel.Log
tail -f storage/logs/laravel.log


## seeding

php artisan make:command RefreshStories
or by Table-name
php artisan db:seed --class=StoriesTableSeeder

## broadcast testing for comment

curl -X POST http://localhost:8000/api/posts/60/comment \
  -H "Authorization: Bearer 3dfsoacOoyKEFKiIHBuLSeIGqB09XMe75lMRWX6P3bf8d3fd" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"content": "Testing clean Laravel broadcast only"}

php artisan serve

mysql -u alex -p -h 127.0.0.1 -P 3306 graf
