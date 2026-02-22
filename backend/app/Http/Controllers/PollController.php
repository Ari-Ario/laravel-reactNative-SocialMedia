<?php
// app/Http/Controllers/PollController.php

namespace App\Http\Controllers;

use App\Events\PollDeleted;
use App\Models\Poll;
use App\Models\PollOption;
use App\Models\PollVote;
use App\Models\CollaborationSpace;
use App\Models\SpaceParticipation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Events\PollCreated;
use App\Events\PollUpdated;


class PollController extends Controller
{
    /**
     * Get all polls for a space
     */
    public function index($spaceId)
    {
        try {
            $space = CollaborationSpace::findOrFail($spaceId);
            $user = auth()->user();

            // Check if user is participant
            $participation = SpaceParticipation::where('space_id', $spaceId)
                ->where('user_id', $user->id)
                ->first();

            if (!$participation) {
                return response()->json(['message' => 'Not authorized'], 403);
            }

            $polls = Poll::where('space_id', $spaceId)
                ->with(['creator', 'options.votes.user'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json(['polls' => $polls]);

        }
        catch (\Exception $e) {
            \Log::error('Error fetching polls: ' . $e->getMessage());
            return response()->json(['message' => 'Error fetching polls'], 500);
        }
    }

    /**
     * Create a new poll
     */
    public function store(Request $request, $spaceId)
    {
        \Log::info('Creating poll for space: ' . $spaceId, $request->all());

        $validator = Validator::make($request->all(), [
            'question' => 'required|string|max:500',
            'options' => 'required|array|min:2|max:10',
            'options.*.text' => 'required|string|max:200',
            'type' => 'required|in:single,multiple,ranked,weighted',
            'settings' => 'required|array',
            'deadline' => 'nullable|date',
            'tags' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            \Log::error('Validation failed:', $validator->errors()->toArray());
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $space = CollaborationSpace::findOrFail($spaceId);
        $user = auth()->user();

        // Check if user is participant
        $participation = SpaceParticipation::where('space_id', $spaceId)
            ->where('user_id', $user->id)
            ->first();

        if (!$participation) {
            return response()->json(['message' => 'Not authorized'], 403);
        }

        DB::beginTransaction();

        try {
            $poll = Poll::create([
                'id' => Str::uuid(),
                'space_id' => $spaceId,
                'created_by' => $user->id,
                'question' => $request->question,
                'type' => $request->type,
                'settings' => $request->settings,
                'deadline' => $request->deadline,
                'tags' => $request->tags,
                'status' => 'active',
                'total_votes' => 0,
                'unique_voters' => 0,
            ]);

            foreach ($request->options as $optionData) {
                PollOption::create([
                    'id' => Str::uuid(),
                    'poll_id' => $poll->id,
                    'text' => $optionData['text'],
                    'votes' => 0,
                ]);
            }

            DB::commit();

            \Log::info('Poll created successfully: ' . $poll->id);
            broadcast(new PollCreated($poll, $spaceId))->toOthers();

            return response()->json([
                'poll' => $poll->load('options'),
                'message' => 'Poll created successfully'
            ], 201);

        }
        catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error creating poll: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);
            return response()->json(['message' => 'Error creating poll'], 500);
        }
    }

    /**
     * Get a single poll
     */
    public function show($spaceId, $pollId)
    {
        try {
            $poll = Poll::where('space_id', $spaceId)
                ->where('id', $pollId)
                ->with(['creator', 'options.votes.user'])
                ->firstOrFail();

            return response()->json(['poll' => $poll]);

        }
        catch (\Exception $e) {
            \Log::error('Error fetching poll: ' . $e->getMessage());
            return response()->json(['message' => 'Poll not found'], 404);
        }
    }

    /**
     * Vote on a poll
     */
    public function vote(Request $request, $spaceId, $pollId)
    {
        $validator = Validator::make($request->all(), [
            'option_ids' => 'required|array|min:1',
            'option_ids.*' => 'exists:poll_options,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $poll = Poll::where('space_id', $spaceId)
                ->where('id', $pollId)
                ->firstOrFail();

            $user = auth()->user();

            // Check if poll is active
            if ($poll->status !== 'active') {
                return response()->json(['message' => 'Poll is not active'], 400);
            }

            // Check deadline
            if ($poll->deadline && now() > $poll->deadline) {
                $poll->update(['status' => 'closed']);
                return response()->json(['message' => 'Poll deadline has passed'], 400);
            }

            // Check if user already voted
            $existingVote = PollVote::where('poll_id', $pollId)
                ->where('user_id', $user->id)
                ->first();

            // Check vote change permission
            $allowVoteChange = $poll->settings['allowVoteChange'] ?? false;
            if ($existingVote && !$allowVoteChange) {
                return response()->json(['message' => 'You have already voted'], 400);
            }

            // Check max selections for multiple choice
            if ($poll->type === 'multiple' &&
            isset($poll->settings['maxSelections']) &&
            count($request->option_ids) > $poll->settings['maxSelections']) {
                return response()->json(['message' => 'Too many selections'], 400);
            }

            DB::beginTransaction();

            try {
                // Remove old votes if changing
                if ($existingVote) {
                    // Get all old votes for this user
                    $oldVotes = PollVote::where('poll_id', $pollId)
                        ->where('user_id', $user->id)
                        ->get();

                    // Decrement vote counts for old options
                    foreach ($oldVotes as $oldVote) {
                        PollOption::where('id', $oldVote->option_id)
                            ->decrement('votes');
                        $oldVote->delete();
                    }
                }

                // Add new votes
                foreach ($request->option_ids as $optionId) {
                    // Check if this option belongs to the poll
                    $option = PollOption::where('id', $optionId)
                        ->where('poll_id', $pollId)
                        ->first();

                    if (!$option) {
                        throw new \Exception('Invalid option ID for this poll');
                    }

                    PollVote::create([
                        'id' => Str::uuid(),
                        'poll_id' => $pollId,
                        'option_id' => $optionId,
                        'user_id' => $user->id,
                    ]);

                    PollOption::where('id', $optionId)->increment('votes');
                }

                // Update poll stats
                $totalVotes = PollVote::where('poll_id', $pollId)->count();
                $uniqueVoters = PollVote::where('poll_id', $pollId)
                    ->distinct('user_id')
                    ->count('user_id');

                $poll->update([
                    'total_votes' => $totalVotes,
                    'unique_voters' => $uniqueVoters,
                ]);

                DB::commit();

                // Refresh poll with relationships
                $poll->refresh();
                $poll->load(['creator', 'options.votes.user']);

                // Broadcast the updated poll
                broadcast(new PollUpdated($poll, $spaceId, $user->id))->toOthers();

                return response()->json([
                    'message' => 'Vote recorded successfully',
                    'poll' => $poll
                ]);

            }
            catch (\Exception $e) {
                DB::rollBack();
                \Log::error('Error in vote transaction: ' . $e->getMessage(), [
                    'trace' => $e->getTraceAsString()
                ]);
                throw $e;
            }

        }
        catch (\Exception $e) {
            \Log::error('Error recording vote: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'poll_id' => $pollId,
                'user_id' => auth()->id()
            ]);
            return response()->json(['message' => 'Error recording vote: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Close a poll
     */
    public function close(Request $request, $spaceId, $pollId)
    {
        try {
            $poll = Poll::where('space_id', $spaceId)
                ->where('id', $pollId)
                ->firstOrFail();

            $user = auth()->user();

            // Check if user can close poll (creator or moderator/owner)
            $space = CollaborationSpace::findOrFail($spaceId);
            $participation = SpaceParticipation::where('space_id', $spaceId)
                ->where('user_id', $user->id)
                ->first();

            if ($poll->created_by !== $user->id && !in_array($participation->role, ['owner', 'moderator'])) {
                return response()->json(['message' => 'Not authorized'], 403);
            }

            $poll->update([
                'status' => 'closed',
                'closed_at' => now(),
                'closed_by' => $user->id,
            ]);

            // Broadcast poll closed event
            // broadcast(new PollClosed($poll))->toOthers();

            return response()->json(['message' => 'Poll closed successfully']);

        }
        catch (\Exception $e) {
            \Log::error('Error closing poll: ' . $e->getMessage());
            return response()->json(['message' => 'Error closing poll'], 500);
        }
    }

    /**
     * Forward poll to other spaces
     */
    public function forward(Request $request, $pollId)
    {
        $validator = Validator::make($request->all(), [
            'target_space_ids' => 'required|array',
            'target_space_ids.*' => 'exists:collaboration_spaces,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $poll = Poll::with(['options'])->findOrFail($pollId);
            $user = auth()->user();

            if (!$user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            // Check if user can forward (creator or moderator/owner of source space)
            $sourceSpace = CollaborationSpace::find($poll->space_id);

            if (!$sourceSpace) {
                return response()->json(['message' => 'Source space not found'], 404);
            }

            $sourceParticipation = SpaceParticipation::where('space_id', $poll->space_id)
                ->where('user_id', $user->id)
                ->first();

            $isCreator = $poll->created_by === $user->id;
            $isModerator = $sourceParticipation && in_array($sourceParticipation->role, ['owner', 'moderator']);

            if (!$isCreator && !$isModerator) {
                return response()->json(['message' => 'Not authorized to forward this poll'], 403);
            }

            $forwardedPolls = [];
            $errors = [];

            // Forward poll to each target space
            foreach ($request->target_space_ids as $targetSpaceId) {
                // Check if target space exists
                $targetSpace = CollaborationSpace::find($targetSpaceId);
                if (!$targetSpace) {
                    $errors[] = "Space {$targetSpaceId} not found";
                    continue;
                }

                // Check if user is participant in target space
                $targetParticipation = SpaceParticipation::where('space_id', $targetSpaceId)
                    ->where('user_id', $user->id)
                    ->first();

                if (!$targetParticipation) {
                    $errors[] = "You are not a participant in space {$targetSpace->title}";
                    continue;
                }

                DB::beginTransaction();

                try {
                    // Create forwarded poll
                    $forwardedPoll = Poll::create([
                        'id' => Str::uuid(),
                        'space_id' => $targetSpaceId,
                        'created_by' => $user->id,
                        'question' => $poll->question,
                        'type' => $poll->type,
                        'settings' => $poll->settings,
                        'deadline' => $poll->deadline,
                        'tags' => $poll->tags,
                        'status' => 'active',
                        'forwarded_from' => array_merge($poll->forwarded_from ?? [], [$poll->space_id]),
                        'parent_poll_id' => $poll->id,
                        'total_votes' => 0,
                        'unique_voters' => 0,
                    ]);

                    // Copy options
                    foreach ($poll->options as $option) {
                        PollOption::create([
                            'id' => Str::uuid(),
                            'poll_id' => $forwardedPoll->id,
                            'text' => $option->text,
                            'votes' => 0,
                        ]);
                    }

                    DB::commit();

                    // Load the created poll with relationships
                    $forwardedPoll->load(['creator', 'options']);
                    $forwardedPolls[] = $forwardedPoll;

                    // Broadcast that a new poll was created in the target space
                    broadcast(new PollCreated($forwardedPoll, $targetSpaceId))->toOthers();

                }
                catch (\Exception $e) {
                    DB::rollBack();
                    \Log::error('Error forwarding poll to space ' . $targetSpaceId . ': ' . $e->getMessage(), [
                        'trace' => $e->getTraceAsString()
                    ]);
                    $errors[] = "Failed to forward to {$targetSpace->title}: " . $e->getMessage();
                }
            }

            $response = [
                'message' => 'Poll forwarding completed',
                'forwarded_polls' => $forwardedPolls,
                'success_count' => count($forwardedPolls)
            ];

            if (!empty($errors)) {
                $response['errors'] = $errors;
                $response['message'] = 'Poll forwarded with some errors';
            }

            return response()->json($response);

        }
        catch (\Exception $e) {
            \Log::error('Error forwarding poll: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'poll_id' => $pollId,
                'user_id' => auth()->id()
            ]);
            return response()->json(['message' => 'Error forwarding poll: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get poll results
     */
    public function results($spaceId, $pollId)
    {
        try {
            $poll = Poll::where('space_id', $spaceId)
                ->where('id', $pollId)
                ->with(['options.votes.user'])
                ->firstOrFail();

            $user = auth()->user();

            // Check permissions for viewing results
            if ($poll->settings['showResults'] === 'creator_only' && $poll->created_by !== $user->id) {
                return response()->json(['message' => 'Not authorized'], 403);
            }

            if ($poll->settings['showResults'] === 'after_deadline' &&
            $poll->deadline && now() <= $poll->deadline &&
            $poll->created_by !== $user->id) {
                return response()->json(['message' => 'Results not available yet'], 403);
            }

            $results = [
                'total_votes' => $poll->total_votes,
                'unique_voters' => $poll->unique_voters,
                'options' => [],
            ];

            foreach ($poll->options as $option) {
                $voters = ($poll->settings['anonymous'] ?? false) ? [] : $option->votes->map(function ($vote) {
                    return [
                    'id' => $vote->user->id,
                    'name' => $vote->user->name,
                    'avatar' => $vote->user->profile_photo,
                    ];
                });

                $results['options'][] = [
                    'id' => $option->id,
                    'text' => $option->text,
                    'votes' => $option->votes->count(),
                    'percentage' => $poll->total_votes > 0
                    ? round(($option->votes->count() / $poll->total_votes) * 100, 1)
                    : 0,
                    'voters' => $voters,
                ];
            }

            return response()->json(['results' => $results]);

        }
        catch (\Exception $e) {
            \Log::error('Error getting poll results: ' . $e->getMessage());
            return response()->json(['message' => 'Error getting poll results'], 500);
        }
    }

    /**
     * Delete a poll permanently
     */
    public function destroy($spaceId, $pollId)
    {
        try {
            $poll = Poll::where('space_id', $spaceId)
                ->where('id', $pollId)
                ->firstOrFail();

            $user = auth()->user();

            // Check if user has permission to delete (creator or moderator/owner)
            $space = CollaborationSpace::findOrFail($spaceId);
            $participation = SpaceParticipation::where('space_id', $spaceId)
                ->where('user_id', $user->id)
                ->first();

            if ($poll->created_by !== $user->id && !in_array($participation->role, ['owner', 'moderator'])) {
                return response()->json(['message' => 'Not authorized to delete this poll'], 403);
            }

            // Check if poll can be deleted (e.g., not already closed/deleted)
            if ($poll->status === 'deleted') {
                return response()->json(['message' => 'Poll already deleted'], 400);
            }

            // Permanently delete the poll and all related data (cascades to options and votes)
            $poll->delete();

            // Optionally broadcast deletion event
            broadcast(new PollDeleted($pollId, $spaceId))->toOthers();

            return response()->json([
                'message' => 'Poll deleted successfully',
                'poll_id' => $pollId
            ]);

        }
        catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => 'Poll not found'], 404);
        }
        catch (\Exception $e) {
            \Log::error('Error deleting poll: ' . $e->getMessage());
            return response()->json(['message' => 'Error deleting poll'], 500);
        }
    }
}