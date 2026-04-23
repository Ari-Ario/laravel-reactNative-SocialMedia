<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class Cors
{
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->header('Origin');
        
        // Define all valid origins explicitly
        $allowedOrigins = [
            'https://zmzir.com',
            'https://www.zmzir.com',
            'https://laravel-reactnative-socialmedia-qcx2q9ci.on-forge.com',
            'http://localhost:8081',
            'http://127.0.0.1:8081',
            'http://localhost:19006',
            'http://localhost:8000',
            'http://localhost:3000'
        ];

        // Ensure we never return a wildcard '*' when credentials are true
        $corsOrigin = in_array($origin, $allowedOrigins) ? $origin : null;

        // Immediately handle preflight OPTIONS requests for Octane performance
        if ($request->isMethod('OPTIONS')) {
            $response = response('OK', 204);
            if ($corsOrigin) {
                $response->headers->set('Access-Control-Allow-Origin', $corsOrigin);
                $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
                $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Authorization, X-Socket-Id, x-socket-id, X-Socket-ID, Accept, Origin, X-Token-Auth');
                $response->headers->set('Access-Control-Allow-Credentials', 'true');
            }
            return $response;
        }

        // Process the actual request
        $response = $next($request);

        // Append CORS headers to the successful (or error) response
        if ($corsOrigin && method_exists($response, 'headers')) {
            $response->headers->set('Access-Control-Allow-Origin', $corsOrigin);
            $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Authorization, X-Socket-Id, x-socket-id, X-Socket-ID, Accept, Origin, X-Token-Auth');
            $response->headers->set('Access-Control-Allow-Credentials', 'true');
        }

        return $response;
    }
}
