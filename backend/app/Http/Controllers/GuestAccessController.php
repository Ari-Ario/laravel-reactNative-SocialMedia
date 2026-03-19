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
    /**
     * Get basic space information for unauthenticated guest views.
     */
    public function getSpaceInfo(string $id)
    {
        $space = CollaborationSpace::with('creator:id,name,profile_photo')
            ->where('id', $id)
            ->firstOrFail();

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

        $space = CollaborationSpace::where('id', $id)->firstOrFail();

        // 1. Create a temporary guest user
        $guestId = Str::random(10);
        $user = User::create([
            'name' => $request->name . ' (Guest)',
            'username' => 'guest_' . $guestId,
            'email' => 'guest_' . $guestId . '@temp.social',
            'password' => Hash::make(Str::random(32)),
            'bio' => 'Temporary guest participant',
        ]);

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
            'space' => $space->load('participants.user'),
            'participation' => $participation,
        ]);
    }
}
