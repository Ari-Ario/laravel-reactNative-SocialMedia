<?php

namespace App\Http\Controllers;

use App\Models\Story;
use App\Models\CollaborationSpace;
use App\Models\MagicEvent;
use App\Events\StoryCreated;
use App\Events\StoryDeleted;
use App\Http\Controllers\SpaceController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StoryController extends Controller
{

    // StoryController constructor
    public function __construct()
    {
        // Cleanup moved to background task for performance
    }

    public function index()
    {
        $user = Auth::user();
        // 🚀 EXTREME PERFORMANCE: Use versioned keys for surgical invalidation
        $version = \Cache::get('stories_global_version');
        if ($version === null) {
            $version = 1;
            \Cache::forever('stories_global_version', $version);
        }
        $cacheKey = "stories_index_user_{$user->id}_v{$version}";

        \Log::info("📖 StoryController@index: User {$user->id} using version {$version} (Key: {$cacheKey})");

        return \Cache::remember($cacheKey, 300, function () use ($user) {
            // Get all active stories grouped by user
            return Story::with(['user', 'viewers' => function ($query) use ($user) {
                $query->where('user_id', $user->id);
            }])
                ->where('expires_at', '>', now())
                ->latest()
                ->get()
                ->groupBy('user_id')
                ->map(function ($userStories) use ($user) {
                    $allViewed = $userStories->every(function ($story) {
                        return $story->viewers->isNotEmpty();
                    });

                    return [
                        'user' => $userStories->first()->user,
                        'stories' => $userStories,
                        'all_viewed' => $allViewed,
                        'latest_story' => $userStories->first(),
                        'viewed' => $allViewed,
                    ];
                })
                ->sortByDesc(function ($group) {
                    return $group['all_viewed'] ? 0 : 1;
                })
                ->values();
        });
    }


    public function markAsViewed($storyId)
    {
        $story = Story::find($storyId);

        if (!$story) {
            return response()->json(['success' => true, 'message' => 'Story already removed']);
        }

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

        $stories = Story::with(['user', 'viewers' => function ($query) use ($user) {
            $query->where('user_id', $user->id);
        }])
            ->where('user_id', $userId)
            ->where('expires_at', '>', now())
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($story) {
            $story->viewed = $story->viewers->isNotEmpty();
            return $story;
        });

        return response()->json($stories);
    }

    public function store(Request $request)
    {
        try {
            $request->validate([
                'media' => 'required|file|mimes:jpg,jpeg,png,mp4,mov,webm|max:40960', // up to 40MB
                'caption' => 'nullable|string|max:2000',
                'location' => 'nullable|string',
                'stickers' => 'nullable|string',
                'type' => 'required|string|in:photo,video',
            ]);

            $file = $request->file('media');
            $extension = $file->getClientOriginalExtension() ?: ($request->type === 'video' ? 'mp4' : 'jpg');
            
            // Custom renaming as per Laravel 12 patterns suggested
            $fileName = time() . '_' . Str::random(10) . '.' . $extension;
            $directory = 'stories/' . Auth::id();
            
            // Store the file using the public disk
            $path = $file->storeAs($directory, $fileName, 'public');

            $story = Story::create([
                'user_id' => Auth::id(),
                'media_path' => $path,
                'caption' => $request->caption,
                'location' => json_decode($request->location, true),
                'stickers' => json_decode($request->stickers, true),
                'type' => $request->type,
                'expires_at' => now()->addHours(24),
            ]);

            \Cache::forget("user_stories_" . Auth::id());

            // 🚀 EXTREME PERFORMANCE: Only broadcast to followers
            $followerIds = Auth::user()->followers()->pluck('users.id')->toArray();
            event(new StoryCreated($story, $followerIds));

            return response()->json([
                'success' => true,
                'data' => $story->load('user')
            ]);

        }
        catch (\Exception $e) {
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




    /**
     * Make story collaborative
     */
    public function makeCollaborative(Request $request, $storyId)
    {
        $user = Auth::user();

        $story = Story::where('id', $storyId)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $request->validate([
            'branch_options' => 'nullable|array',
            'interactive_elements' => 'nullable|array',
        ]);

        // Create collaboration space for the story
        $spaceController = app(SpaceController::class);
        $space = $spaceController->createSpaceFromStory($story, $request->all());

        // Update story
        $story->update([
            'is_collaborative' => true,
            'linked_project_id' => $space->id,
            'branch_options' => $request->branch_options,
            'interactive_elements' => $request->interactive_elements,
        ]);

        return response()->json([
            'story' => $story->load(['collaborationSpace', 'user']),
            'space' => $space,
            'message' => 'Story is now collaborative'
        ]);
    }

    /**
     * Add to story chain
     */
    public function addToChain(Request $request, $storyId)
    {
        $user = Auth::user();

        $story = Story::where('id', $storyId)
            ->where('is_collaborative', true)
            ->firstOrFail();

        // Check if user can contribute
        if ($story->user_id !== $user->id &&
        !in_array($user->id, $story->collaborators ?? [])) {
            return response()->json([
                'message' => 'You are not authorized to contribute to this story'
            ], 403);
        }

        $request->validate([
            'media_path' => 'required|string',
            'caption' => 'nullable|string',
            'branch_choice' => 'nullable|string', // If choosing from branch options
        ]);

        // Create new story segment
        $newStory = Story::create([
            'user_id' => $user->id,
            'media_path' => $request->media_path,
            'caption' => $request->caption,
            'expires_at' => $story->expires_at,
            'parent_story_id' => $story->id,
            'chain_length' => $story->chain_length + 1,
            'is_collaborative' => true,
            'linked_project_id' => $story->linked_project_id,
            'collaborators' => $story->collaborators,
        ]);

        // Update original story chain length
        $story->increment('chain_length');

        // Add to space activity
        if ($story->linked_project_id) {
            $space = CollaborationSpace::find($story->linked_project_id);
            if ($space) {
                $space->update([
                    'activity_metrics->story_additions' => ($space->activity_metrics['story_additions'] ?? 0) + 1,
                ]);

                // Create magic event
                MagicEvent::create([
                    'id' => Str::uuid(),
                    'space_id' => $space->id,
                    'event_type' => 'story_continued',
                    'event_data' => [
                        'added_by' => $user->id,
                        'new_story_id' => $newStory->id,
                        'chain_position' => $story->chain_length,
                    ],
                ]);
            }
        }

        return response()->json([
            'new_story' => $newStory,
            'original_story' => $story,
            'message' => 'Added to story chain'
        ]);
    }

    /**
     * Delete story
     */
    public function destroy($id)
    {
        $story = Story::findOrFail($id);

        if ($story->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Delete media file
        if ($story->media_path) {
            Storage::disk('public')->delete($story->media_path);
        }

        $userId = $story->user_id;
        $storyId = $story->id;
        
        $story->delete();

        \Cache::forget("user_stories_" . $userId);
        
        // 🚀 EXTREME PERFORMANCE: Only broadcast deletion to followers
        $followerIds = Auth::user()->followers()->pluck('users.id')->toArray();
        event(new StoryDeleted($storyId, $userId, $followerIds));

        return response()->json(['success' => true, 'message' => 'Story deleted successfully']);
    }
    /**
     * Reply to a story
     */
    public function reply(Request $request, $id)
    {
        $request->validate([
            'message' => 'required|string|max:1000',
        ]);

        $story = Story::with('user')->findOrFail($id);
        $user = Auth::user();

        if ($story->user_id === $user->id) {
            return response()->json(['message' => 'You cannot reply to your own story'], 400);
        }

        // 1. Get or create direct space
        $spaceController = app(SpaceController::class);
        $response = $spaceController->getOrCreateDirectSpace($request, $story->user_id);
        $spaceData = json_decode($response->getContent(), true);
        
        if (!isset($spaceData['space']['id'])) {
            return response()->json(['message' => 'Could not establish chat space'], 500);
        }

        $spaceId = $spaceData['space']['id'];

        // 2. Send message via SpaceController logic
        $metadata = [
            'story_id' => $story->id,
            'media_url' => $story->media_path,
            'media_type' => $story->type,
            'caption' => $story->caption,
            'creator_name' => $story->user->name,
            'creator_avatar' => $story->user->profile_photo,
            'is_internal_share' => true,
            'appended_message' => $request->message
        ];

        $request->merge([
            'content' => $request->message,
            'type' => 'story_share',
            'metadata' => $metadata
        ]);

        return $spaceController->sendMessage($request, $spaceId);
    }

    /**
     * Share a story
     */
    public function share(Request $request, $id)
    {
        $request->validate([
            'space_id' => 'sometimes|string',
            'user_id' => 'sometimes|integer',
            'message' => 'nullable|string|max:1000',
        ]);

        $story = Story::with('user')->findOrFail($id);
        $user = Auth::user();

        // If space_id or user_id is provided, it's an internal share
        if ($request->has('space_id') || $request->has('user_id')) {
            $spaceController = app(SpaceController::class);
            $spaceId = $request->space_id;

            if (!$spaceId && $request->has('user_id')) {
                // Get or create direct space
                $response = $spaceController->getOrCreateDirectSpace($request, $request->user_id);
                $spaceData = json_decode($response->getContent(), true);
                $spaceId = $spaceData['space']['id'] ?? null;
            }

            if ($spaceId) {
                $metadata = [
                    'story_id' => $story->id,
                    'media_url' => $story->media_path,
                    'media_type' => $story->type,
                    'caption' => $story->caption,
                    'creator_name' => $story->user->name,
                    'creator_avatar' => $story->user->profile_photo,
                    'is_internal_share' => true,
                    'appended_message' => $request->message
                ];

                $request->merge([
                    'content' => $request->message ?: 'Shared a story',
                    'type' => 'story_share',
                    'metadata' => $metadata
                ]);

                return $spaceController->sendMessage($request, $spaceId);
            }
        }

        return response()->json([
            'message' => 'Story shared successfully',
            'story' => $story->load('user')
        ]);
    }
}
