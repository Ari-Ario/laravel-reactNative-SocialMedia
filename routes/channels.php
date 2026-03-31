<?php

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;

Broadcast::channel('post-{postId}', function ($user, $postId) {
    return ['id' => $user->id, 'name' => $user->name];
});

// channel for chatbot training
Broadcast::channel('chatbot-training', function ($user) {
    // Allow only private users and admins to listen to this channel
    return $user->is_private || $user->is_admin
    ? ['id' => $user->id, 'name' => $user->name, 'is_private' => $user->is_private, 'is_admin' => $user->is_admin]
    : false;
});

Broadcast::channel('space-{spaceId}', function ($user, $spaceId) {
    // Resolve UUID if spaceId is a slug/name
    if (!\Illuminate\Support\Str::isUuid($spaceId)) {
        $space = \App\Models\CollaborationSpace::where('slug', $spaceId)
            ->orWhere('id', $spaceId) // Try ID too just in case
            ->first();

        if (!$space) {
            // Last resort: try title if it was passed by name
            $space = \App\Models\CollaborationSpace::where('title', $spaceId)->first();
        }

        if (!$space)
            return false;
        $actualSpaceId = $space->id;
    }
    else {
        $actualSpaceId = $spaceId;
    }

    Log::info('🔐 Auth attempt', [
        'user_id' => $user->id ?? 'null',
        'space_id' => $actualSpaceId,
        'input_id' => $spaceId
    ]);

    // Check if user is a participant
    $participation = \App\Models\SpaceParticipation::where('space_id', $actualSpaceId)
        ->where('user_id', $user->id)
        ->first();

    if ($participation) {
        Log::info('✅ Auth success', ['user_id' => $user->id, 'space_id' => $spaceId]);
        return [
        'id' => $user->id,
        'name' => $user->name,
        'profile_photo' => $user->profile_photo,
        'role' => $participation->role,
        ];
    }

    Log::warning('❌ Auth failed - not a participant', ['user_id' => $user->id, 'space_id' => $spaceId]);
    return false;
});

// Also keep your existing user channel
// Public user channel for frontend notifications (matches user.ID)
// No authorization needed as it's used for public broadcasts to specific IDs
Broadcast::channel('user-{userId}', function ($user, $userId) {
    return (int)$user->id === (int)$userId;
});

// Optional: Global posts channel (public - no auth needed)
Broadcast::channel('posts-global', function ($user) {
    return true; // Public channel doesn't need auth
});