<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class UserSearchController extends Controller
{
    public function search(Request $request)
    {
        $request->validate([
            'query' => 'required|string|min:1',
            'limit' => 'sometimes|integer|min:1|max:50',
        ]);

        $searchQuery = $request->input('query');
        $limit = $request->input('limit', 10);
        $currentUserId = auth()->id();

        // Normalize phone numbers for better matching
        $normalizedPhone = preg_replace('/[^0-9+]/', '', $searchQuery);

        $users = User::where('id', '!=', $currentUserId)
            ->where(function ($q) use ($searchQuery, $normalizedPhone) {
            $q->where('name', 'like', "%{$searchQuery}%")
                ->orWhere('email', 'like', "%{$searchQuery}%")
                ->orWhere('username', 'like', "%{$searchQuery}%")
                ->orWhere('phone', 'like', "%{$searchQuery}%")
                // Also search by normalized phone if it's different
                ->orWhere('phone', 'like', "%{$normalizedPhone}%");
        })
            ->limit($limit)
            ->get(['id', 'name', 'username', 'email', 'phone', 'profile_photo']);

        return response()->json([
            'users' => $users,
            'query' => $searchQuery,
            'count' => $users->count(),
        ]);
    }

    public function lookup(Request $request)
    {
        $request->validate([
            'identifier' => 'required|string',
            'type' => 'required|in:email,phone,user_id',
        ]);

        $identifier = $request->identifier;
        $type = $request->type;
        $currentUserId = auth()->id();

        $query = User::query();

        if ($type === 'email') {
            $query->where('email', $identifier);
        } elseif ($type === 'phone') {
            $query->where('phone', $identifier);
        } else {
            $query->where('id', $identifier);
        }

        $user = $query->first(['id', 'name', 'username', 'email', 'phone', 'profile_photo']);

        return response()->json([
            'exists' => (bool)$user,
            'user' => $user
        ]);
    }

    public function batchLookup(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:users,id'
        ]);

        $users = User::whereIn('id', $request->ids)
            ->get(['id', 'name', 'username', 'email', 'phone', 'profile_photo']);

        return response()->json(['users' => $users]);
    }
}