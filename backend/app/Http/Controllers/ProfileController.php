<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Post;
use App\Models\Follower;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function uploadPhoto(Request $request)
    {
        $request->validate([
            'profile_photo' => 'required|image|mimes:jpeg,png,jpg|max:20480'
        ]);

        $user = Auth::user();
        
        // Delete old photo if exists
        if ($user->profile_photo) {
            Storage::disk('public')->delete($user->profile_photo);
        }

        // Store new photo
        $path = $request->file('profile_photo')->store(
            'profile-photos/' . $user->id, 'public'
        );

        // Update user record
        $user->profile_photo = $path;
        $user->save();

        return response()->json([
            'message' => 'Profile photo updated',
            'path' => $path,
            'url' => Storage::url($path)
        ]);
    }

    public function deletePhoto()
    {
        $user = Auth::user();
        
        if ($user->profile_photo) {
            Storage::disk('public')->delete($user->profile_photo);
            $user->profile_photo = null;
            $user->save();
        }

        return response()->json(['message' => 'Profile photo removed']);
    }

    public function updateName(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $user = auth()->user();
        $user->name = $request->name;
        $user->save();

        return response()->json(['user' => $user]);
    }


    // Requesting other users and follower
    public function show($userId)
    {
        $user = User::withCount([
            'posts',
            'followers',
            'following'
        ])->findOrFail($userId);

        $posts = Post::where('user_id', $userId)
            ->withCount(['reactions', 'comments'])
            ->with(['media', 'reactions' => function($query) {
                $query->where('user_id', Auth::id());
            }])
            ->latest()
            ->get();

        $isFollowing = Follower::where([
            'follower_id' => Auth::id(),
            'following_id' => $userId
        ])->exists();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'last_name' => $user->last_name,
            'username' => $user->username,
            'bio' => $user->bio,
            'profile_photo' => $user->profile_photo,
            'posts_count' => $user->posts_count,
            'followers_count' => $user->followers_count,
            'following_count' => $user->following_count,
            'is_following' => $isFollowing,
            'posts' => $posts
        ]);
    }

    public function follow(Request $request, $userId)
    {
        $request->validate([
            'action' => 'required|in:follow,unfollow'
        ]);

        $user = User::findOrFail($userId);
        $currentUser = Auth::user();

        if ($request->action === 'follow') {
            $currentUser->following()->syncWithoutDetaching([$userId]);
            $message = 'User followed successfully';
        } else {
            $currentUser->following()->detach($userId);
            $message = 'User unfollowed successfully';
        }

        $user->loadCount('followers');

        return response()->json([
            'is_following' => $request->action === 'follow',
            'followers_count' => $user->followers_count,
            'message' => $message
        ]);
    }

}