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
            'query' => 'required|string|min:2',
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

        $query = User::where('id', '!=', $currentUserId);

        switch ($type) {
            case 'email':
                $query->where('email', $identifier);
                break;
            case 'phone':
                // Normalize phone number (remove spaces, etc.)
                $normalizedPhone = preg_replace('/[^0-9+]/', '', $identifier);
                $query->where('phone', 'like', "%{$normalizedPhone}%");
                break;
            case 'user_id':
                $query->where('id', $identifier);
                break;
        }

        $user = $query->first(['id', 'name', 'username', 'email', 'phone', 'profile_photo']);

        if ($user) {
            return response()->json([
                'exists' => true,
                'user' => $user,
            ]);
        }

        return response()->json([
            'exists' => false,
            'message' => 'User not found',
        ]);
    }
}