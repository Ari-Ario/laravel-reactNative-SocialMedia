## Showing laravel.Log
tail -f storage/logs/laravel.log

## serve with host or just without numbers
php artisan serve --host=0.0.0.0 --port=8000

## seeding

php artisan make:command RefreshStories
or by Table-name
php artisan db:seed --class=StoriesTableSeeder

## it needs curl for pusher 7

sudo apt install php8.4-curl

## python packages installation for AI
pip install fastapi uvicorn sentence-transformers faiss-cpu transformers torch wikipedia wikipedia-api
pip install bitsandbytes accelerate

### if not working then force pip with this at end: 
--break-system-packages

install and activate venve as python virtual environment in directory python-ai-service/:

sudo apt install python3-venv

source venv/bin/activate

### datasets is for streaming huge corpora (C4, CC-News, OpenWebText2…). requests and bs4 are for Wikipedia/StackExchange.

pip install datasets requests beautifulsoup4
pip install feedparser
pip install youtube-transcript-api

### then uvicorn
sudo apt install uvicorn

### finally run in cd python-ai-service
uvicorn main:app --host 127.0.0.1 --port=8001
by error:
sudo fuser -k 8001/tcp

pkill -f uvicorn

uvicorn main:app --reload --host 127.0.0.1 --port 8001


## in case the images are not shown:

php artisan storage:link


## clear backend:

php artisan config:clear
php artisan route:clear
php artisan cache:clear
php artisan view:clear
php artisan optimize:clear