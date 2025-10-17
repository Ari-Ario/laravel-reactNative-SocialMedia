<?php

namespace App\Http\Controllers;

use App\Events\NewFollower;
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
        try {
            $authUserId = Auth::id();

            // Retrieve the user info
            $user = User::withCount([
                'posts',
                'followers',
                'following'
            ])->findOrFail($userId);

            // Get the posts exactly like index()
            $posts = Post::where('user_id', $userId)
                ->with([
                    'user',
                    'media',
                    'reactions',
                    'reactionCounts',
                    'comments.user',
                    'comments.reaction_comments.user',
                    'comments.replies' => function ($query) {
                        $query->with(['user', 'reaction_comments.user'])
                            ->withCount('reaction_comments');
                    },
                    'comments.replies.replies' => function ($query) {
                        $query->with(['user', 'reaction_comments.user'])
                            ->withCount('reaction_comments');
                    },
                    'reposts.user'
                ])
                ->withCount([
                    'reactions',
                    'comments',
                    'reposts'
                ])
                ->withExists(['reposts as is_reposted' => function($query) use ($authUserId) {
                    $query->where('user_id', $authUserId);
                }])
                ->latest()
                ->paginate(10);

            // Recursively transform all comments and replies
            $posts->getCollection()->transform(function ($post) {
                $transformComment = function ($comment) use (&$transformComment) {
                    $comment->reaction_comments_count = $comment->reaction_comments->count();

                    if ($comment->replies) {
                        $comment->replies->each($transformComment);
                    }

                    return $comment;
                };

                $post->comments->each($transformComment);
                return $post;
            });

            // Return the same structure, but wrap with user info
            return response()->json([
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'last_name' => $user->last_name,
                    'username' => $user->username,
                    'bio' => $user->bio,
                    'profile_photo' => $user->profile_photo,
                    'posts_count' => $user->posts_count,
                    'followers_count' => $user->followers_count,
                    'following_count' => $user->following_count,
                    'is_following' => Follower::where([
                        'follower_id' => $authUserId,
                        'following_id' => $userId
                    ])->exists(),
                ],
                'posts' => $posts
            ]);

        } catch (\Exception $e) {
            \Log::error('PostController@show error: '.$e->getMessage());
            return response()->json(['error' => 'Server error'], 500);
        }
    }


    // follow  method
    public function follow(Request $request, $userId)
    {
        $request->validate([
            'action' => 'required|in:follow,unfollow'
        ]);

        try {
            $user = User::findOrFail($userId);
            $currentUser = Auth::user();

            if ($request->action === 'follow') {
                $currentUser->following()->syncWithoutDetaching([$userId]);
                $message = 'User followed successfully';

                // Notify the followed user
                $user->notify(new NewFollower(
                    $currentUser->id,
                    $currentUser->name,
                    $user->id
                ));
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
        } catch (\Exception $e) {
            \Log::error('Follow action failed: ' . $e->getMessage(), [
                'userId' => $userId,
                'action' => $request->action,
                'error' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Failed to process follow action',
                'error' => $e->getMessage()
            ], 500);
        }
    }

}