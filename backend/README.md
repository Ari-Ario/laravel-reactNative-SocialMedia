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
  -d '{"content": "Testing clean Laravel broadcast only"}'

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