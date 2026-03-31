<?php

return [
    'default' => env('BROADCAST_CONNECTION', 'reverb'),
    // 'default' => 'log',

    'connections' => [

        'reverb' => [
            'driver' => 'reverb',
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
            'app_id' => env('REVERB_APP_ID'),
            'options' => [
                'host' => env('APP_ENV') === 'local' ? 'localhost' : env('REVERB_HOST'),
                'port' => env('APP_ENV') === 'local' ? 8080 : env('REVERB_PORT', 443),
                'scheme' => env('APP_ENV') === 'local' ? 'http' : env('REVERB_SCHEME', 'https'),
                'useTLS' => env('APP_ENV') === 'local' ? false : (env('REVERB_SCHEME', 'https') === 'https'),
            ],
            'client_options' => [
                // Guzzle client options...
            ],
        ],

        'pusher' => [
            'driver' => 'pusher',
            'key' => env('PUSHER_APP_KEY'),
            'secret' => env('PUSHER_APP_SECRET'),
            'app_id' => env('PUSHER_APP_ID'),
            'options' => [
                'cluster' => env('PUSHER_APP_CLUSTER'),
                'host' => 'api-' . env('PUSHER_APP_CLUSTER') . '.pusher.com',
                'port' => 443,
                'scheme' => 'https',
                'encrypted' => true,
                'useTLS' => true,
                'curl_options' => [
                    CURLOPT_SSL_VERIFYHOST => 0,
                    CURLOPT_SSL_VERIFYPEER => 0,
                ],
            ],
        ],
    ],
];