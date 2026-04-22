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

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'register', 'resend-verification-code', '*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['https://zmzir.com', 'http://localhost:19006', 'http://localhost:8081', 'http://localhost:3000'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*', 'X-Socket-Id', 'X-Requested-With'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
