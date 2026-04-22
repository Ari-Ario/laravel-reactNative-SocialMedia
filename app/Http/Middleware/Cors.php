<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class Cors
{
    public function handle(Request $request, Closure $next)
    {
        $headers = [
            'Access-Control-Allow-Origin'      => $request->header('Origin') ?: '*',
            'Access-Control-Allow-Methods'     => 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers'     => 'Content-Type, X-Requested-With, Authorization, X-CSRF-TOKEN, X-Socket-Id, x-socket-id, X-Socket-ID, Accept, Origin, X-Token-Auth',
            'Access-Control-Allow-Credentials' => 'true',
        ];

        if ($request->isMethod('OPTIONS')) {
            return response()->json('OK', 204, $headers);
        }

        $response = $next($request);

        foreach ($headers as $key => $value) {
            if (method_exists($response, 'header')) {
                $response->header($key, $value);
            } elseif (property_exists($response, 'headers') && method_exists($response->headers, 'set')) {
                $response->headers->set($key, $value);
            }
        }

        return $response;
    }
}
