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
        $stories = Story::with(['user', 'viewers' => function ($query) use ($user) {
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
                }
                );

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
                'media' => 'required|file|mimes:jpg,jpeg,png,mp4|max:10240',
                'caption' => 'nullable|string|max:2000',
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
        $spaceController = new SpaceController();
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
}