<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => [],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['https://zmzir.com', 'https://www.zmzir.com', 'https://laravel-reactnative-socialmedia-qcx2q9ci.on-forge.com', 'http://localhost:8081'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Content-Type', 'X-Requested-With', 'Authorization', 'X-Socket-Id', 'x-socket-id', 'X-Socket-ID', 'Accept', 'Origin'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
