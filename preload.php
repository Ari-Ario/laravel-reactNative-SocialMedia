<?php

/**
 * Laravel PHP 8.4 OpCache Preloader
 * 
 * This script is executed by PHP's OpCache engine before the first request arrives.
 * It compiles all core framework files into RAM, drastically reducing CPU overhead
 * and disk reads for subsequent requests.
 */

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$kernel->handle(
    Illuminate\Http\Request::capture()
);
