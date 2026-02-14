<?php

return [
    'default' => env('BROADCAST_DRIVER', 'pusher'),
    // 'default' => 'log',

'connections' => [
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