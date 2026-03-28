<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class Cors
{
    public function handle(Request $request, Closure $next)
    {
        // Allow requests from any origin
        return $next($request)
            ->header('Access-Control-Allow-Origin', $request->header('Origin', '*'))
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, X-Token-Auth, Authorization, X-CSRF-TOKEN')
            ->header('Access-Control-Allow-Credentials', 'true');
    }
}
