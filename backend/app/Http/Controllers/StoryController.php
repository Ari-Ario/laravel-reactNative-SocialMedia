<?php

namespace App\Http\Controllers;

use App\Models\Story;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class StoryController extends Controller
{

    // StoryController constructor
    public function __construct()
    {
        // Cleanup expired stories on every controller instantiation
        $deletedCount = Story::cleanupExpiredStories();
        
        if ($deletedCount > 0) {
            \Log::info("Cleaned up {$deletedCount} expired stories");
        }
    }


    public function index()
    {
        // Cleanup expired stories first
        Story::cleanupExpiredStories();

        $user = Auth::user();
        
        // Get all active stories grouped by user
        $stories = Story::with(['user', 'viewers' => function($query) use ($user) {
            $query->where('user_id', $user->id);
        }])
        ->where('expires_at', '>', now())
        ->latest()
        ->get()
        ->groupBy('user_id')
        ->map(function ($userStories) use ($user) {
            // Check if all stories from this user are viewed
            $allViewed = $userStories->every(function ($story) {
                return $story->viewers->isNotEmpty();
            });
            
            return [
                'user' => $userStories->first()->user,
                'stories' => $userStories,
                'all_viewed' => $allViewed,
                'latest_story' => $userStories->first(), // Most recent story
                'viewed' => $allViewed, // For backward compatibility
            ];
        })
        ->sortByDesc(function ($group) {
            // Sort groups: unviewed first, then viewed
            return $group['all_viewed'] ? 0 : 1;
        })
        ->values();

        return response()->json($stories);
    }

    
    public function markAsViewed($id)
    {
        $story = Story::findOrFail($id);

        if (!Auth::user()->viewedStories()->where('story_id', $story->id)->exists()) {
            Auth::user()->viewedStories()->attach($story->id);
        }

        return response()->json(['success' => true]);
    }

    public function userStories($userId)
    {
        // Cleanup expired stories first
        Story::cleanupExpiredStories();

        $user = Auth::user();
        
        $stories = Story::with(['user', 'viewers' => function($query) use ($user) {
            $query->where('user_id', $user->id);
        }])
        ->where('user_id', $userId)
        ->where('expires_at', '>', now())
        ->orderBy('created_at', 'asc')
        ->get()
        ->map(function($story) {
            $story->viewed = $story->viewers->isNotEmpty();
            return $story;
        });

        return response()->json($stories);
    }

    public function store(Request $request)
    {
        try {
            $request->validate([
                'media' => 'required|file|mimes:jpg,jpeg,png,mp4|max:10240',
                'caption' => 'nullable|string|max:255',
            ]);

            // Upload and store the new story
            $path = $request->file('media')->store('stories/' . Auth::id(), 'public');
            
            // Handle file upload
            $path = $request->file('media')->store('stories/' . Auth::id(), 'public');

            $story = Story::create([
                'user_id' => Auth::id(),
                'media_path' => $path,
                'caption' => $request->caption,
            ]);

            return response()->json([
                'success' => true,
                'data' => $story->load('user')
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => $e instanceof \Illuminate\Validation\ValidationException 
                    ? $e->errors() 
                    : null
            ], 422);
        }
    }


    // Not used funcs 
    public function show($id)
    {
        $story = Story::with('user')
            ->where('id', $id)
            ->where('expires_at', '>', now())
            ->firstOrFail();

        // Mark as viewed
        if (!Auth::user()->viewedStories()->where('story_id', $story->id)->exists()) {
            Auth::user()->viewedStories()->attach($story->id);
        }

        return response()->json($story);
    }

    // Already handled in Story Model
    // protected function cleanupExpiredStories()
    // {
    //     $expiredStories = Story::where('expires_at', '<=', now())->get();

    //     foreach ($expiredStories as $story) {
    //         Storage::disk('public/stories/')->delete($story->media_path);
    //         $story->delete();
    //     }
    // }
}