<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckUserRestriction
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($user = $request->user()) {
            $restriction = \App\Models\UserRestriction::where('user_id', $user->id)
                ->whereIn('type', ['suspension', 'ban'])
                ->active()
                ->latest()
                ->first();

            if ($restriction) {
                return response()->json([
                    'error' => 'Account Restricted',
                    'type' => $restriction->type,
                    'reason' => $restriction->reason,
                    'expires_at' => $restriction->expires_at ? $restriction->expires_at->toIso8601String() : null,
                    'message' => $restriction->type === 'ban' 
                        ? 'Your account has been permanently banned.' 
                        : 'Your account is currently suspended.'
                ], 403);
            }
        }

        return $next($request);
    }
}
