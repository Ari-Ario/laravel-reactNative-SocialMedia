<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RestrictGuests
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->is_guest) {
            // Allow lists of routes guests CAN access
            $allowedRoutes = [
                'api/user',
                'api/pusher/auth',
                'api/broadcasting/auth', // Added for Unified Reverb Support
                'api/logout',
                'api/collaborative-activities'
            ];

            $isAllowed = false;
            foreach ($allowedRoutes as $route) {
                if ($request->is($route) || $request->is(ltrim($route, 'api/'))) {
                    $isAllowed = true;
                    break;
                }
            }

            if ($request->is('api/spaces/*') || $request->routeIs('spaces.*')) {
                $isAllowed = true;
            }

            if (!$isAllowed) {
                return response()->json(['message' => 'Guest accounts cannot access this endpoint.'], 403);
            }
        }

        return $next($request);
    }
}
