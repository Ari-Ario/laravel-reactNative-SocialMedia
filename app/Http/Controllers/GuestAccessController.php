<?php

namespace App\Http\Controllers;

use App\Models\CollaborationSpace;
use App\Models\User;
use App\Models\SpaceParticipation;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;

class GuestAccessController extends Controller
{
    public function getSpaceInfo(string $id)
    {
        try {
            $space = CollaborationSpace::with(['creator:id,name,profile_photo', 'activeCall'])
                ->where('id', $id)
                ->firstOrFail();
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('GuestAccess Error: ' . $e->getMessage(), ['id' => $id]);
            return response()->json(['error' => 'Space not found or unavailable'], 404);
        }

        // Check if the space is Joinable by guests (General spaces)
        // Protected spaces might only show title/description
        return response()->json([
            'space' => [
                'id' => $space->id,
                'title' => $space->title,
                'description' => $space->description,
                'space_type' => $space->space_type,
                'image_url' => $space->image_url,
                'creator' => $space->creator,
                'active_call' => $space->activeCall,
            ]
        ]);
    }

    /**
     * Join a space as a temporary guest.
     */
    public function joinAsGuest(Request $request, string $id)
    {
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $space = CollaborationSpace::with('activeCall')->where('id', $id)->firstOrFail();

        // 1. Create a temporary guest user
        $guestId = Str::random(10);
        $user = User::create([
            'name' => $request->name . ' (Guest)',
            'username' => 'guest_' . $guestId,
            'email' => 'guest_' . $guestId . '@temp.social',
            'password' => Hash::make(Str::random(32)),
            'bio' => 'Temporary guest participant',
        ]);
        $user->markEmailAsVerified();

        // 2. Add to space as participant
        $participation = SpaceParticipation::create([
            'space_id' => $space->id,
            'user_id' => $user->id,
            'role' => 'participant', // Guests are participants by default
            'joined_at' => now(),
            'permissions' => [
                'can_message' => true,
                'can_call' => true,
                'can_invite' => false,
            ]
        ]);

        // 3. Generate token for the guest
        $token = $user->createToken('guest-token')->plainTextToken;

        return response()->json([
            'user' => $user->toAuthArray(),
            'token' => $token,
            'space' => $space->load(['participants.user', 'activeCall']),
            'participation' => $participation,
        ]);
    }
    /**
     * Join a space as an anonymous viewer (TV mode).
     */
    public function joinAsViewer(string $id)
    {
        $space = CollaborationSpace::where('id', $id)->firstOrFail();

        // Check if the space is a channel/broadcast type
        if ($space->space_type !== 'channel') {
            return response()->json(['error' => 'Public viewing is only available for broadcast channels'], 403);
        }

        // 1. Create a temporary guest user automatically
        $viewerNumber = rand(1000, 9999);
        $guestId = Str::random(10);
        $user = User::create([
            'name' => 'Viewer #' . $viewerNumber,
            'username' => 'guest_v_' . $guestId,
            'email' => 'guest_v_' . $guestId . '@temp.social',
            'password' => Hash::make(Str::random(32)),
            'bio' => 'Anonymous Viewer',
        ]);
        $user->markEmailAsVerified();

        // 2. Add to space as a restricted participant (read-only)
        $participation = SpaceParticipation::create([
            'space_id' => $space->id,
            'user_id' => $user->id,
            'role' => 'participant',
            'joined_at' => now(),
            'permissions' => [
                'can_message' => false,
                'can_call' => false,
                'can_invite' => false,
                'is_viewer' => true, // Flag for UI to hide controls
            ]
        ]);

        // 3. Generate token
        $token = $user->createToken('viewer-token')->plainTextToken;

        return response()->json([
            'user' => $user->toAuthArray(),
            'token' => $token,
            'space' => $space->load('participants.user'),
            'participation' => $participation,
        ]);
    }
}
