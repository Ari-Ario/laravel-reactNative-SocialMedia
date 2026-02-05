<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Models\CollaborationSpace;
use App\Models\CollaborativeActivity;
use App\Models\SpaceParticipation;
use Illuminate\Support\Facades\DB;

class CollaborativeActivityController extends Controller
{
    /**
     * Store a newly created collaborative activity
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'space_id' => 'required|string|exists:collaboration_spaces,id',
            'activity_type' => 'required|string|max:255',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'scheduled_start' => 'nullable|date',
            'scheduled_end' => 'nullable|date|after:scheduled_start',
            'is_recurring' => 'boolean',
            'recurrence_pattern' => 'nullable|string|in:daily,weekly,monthly',
            'duration_minutes' => 'nullable|integer|min:5|max:480',
            'max_participants' => 'nullable|integer|min:1',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors(),
                'message' => 'Validation failed'
            ], 422);
        }

        DB::beginTransaction();
        try {
            $space = CollaborationSpace::find($request->space_id);
            if (!$space) {
                return response()->json([
                    'message' => 'Space not found'
                ], 404);
            }

            // Check if user is a participant in the space
            $isParticipant = SpaceParticipation::where('space_id', $space->id)
                ->where('user_id', auth()->id())
                ->exists();
            
            if (!$isParticipant && $space->creator_id !== auth()->id()) {
                return response()->json([
                    'message' => 'You are not a participant in this space'
                ], 403);
            }

            // Create the activity
            $activity = CollaborativeActivity::create([
                'space_id' => $space->id,
                'created_by' => auth()->id(),
                'activity_type' => $request->activity_type,
                'title' => $request->title,
                'description' => $request->description,
                'scheduled_start' => $request->scheduled_start ? now()->parse($request->scheduled_start) : null,
                'scheduled_end' => $request->scheduled_end ? now()->parse($request->scheduled_end) : null,
                'is_recurring' => $request->is_recurring ?? false,
                'recurrence_pattern' => $request->recurrence_pattern,
                'duration_minutes' => $request->duration_minutes ?? 60,
                'max_participants' => $request->max_participants,
                'status' => $request->scheduled_start ? 'scheduled' : 'proposed',
                'metadata' => $request->metadata ?? [],
                'proposed_at' => now(),
            ]);

            // Add participants
            $participantIds = $request->participant_ids ?? [];
            if (empty($participantIds)) {
                // If no participants specified, use all space participants
                $participantIds = $space->participations()
                    ->where('user_id', '!=', auth()->id())
                    ->pluck('user_id')
                    ->toArray();
            }
            
            // Add creator as participant
            $participantIds[] = auth()->id();
            $participantIds = array_unique($participantIds);
            
            $activity->participants()->sync($participantIds);

            // Update space activity metrics
            $activityMetrics = $space->activity_metrics ?? [];
            $activityMetrics['proposed_activities'] = ($activityMetrics['proposed_activities'] ?? 0) + 1;
            $activityMetrics['last_activity_proposed'] = now()->toISOString();
            
            $space->update([
                'activity_metrics' => $activityMetrics,
                'current_focus' => $request->activity_type,
            ]);

            // Broadcast activity created event
            // You would typically use broadcasting here
            // broadcast(new CollaborativeActivityCreated($activity, $space))->toOthers();

            DB::commit();

            return response()->json([
                'activity' => $activity->load('participants', 'creator'),
                'space' => $space->fresh(['participants.user']),
                'message' => 'Collaborative activity created successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error creating collaborative activity: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to create collaborative activity',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Get activities for a specific space
     */
    public function getSpaceActivities($spaceId)
    {
        $space = CollaborationSpace::find($spaceId);
        if (!$space) {
            return response()->json([
                'activities' => [],
                'message' => 'Space not found'
            ], 404);
        }

        // Check if user is a participant
        $isParticipant = SpaceParticipation::where('space_id', $space->id)
            ->where('user_id', auth()->id())
            ->exists();
        
        if (!$isParticipant && $space->creator_id !== auth()->id()) {
            return response()->json([
                'activities' => [],
                'message' => 'You are not a participant in this space'
            ], 403);
        }

        $activities = CollaborativeActivity::where('space_id', $spaceId)
            ->with(['creator', 'participants'])
            ->where(function($query) {
                $query->where('status', '!=', 'archived')
                      ->orWhere('created_at', '>', now()->subDays(7));
            })
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json([
            'activities' => $activities,
            'space' => $space->only(['id', 'title', 'space_type']),
            'total' => $activities->total(),
            'current_page' => $activities->currentPage(),
        ]);
    }

    /**
     * Update activity status (start, complete, cancel, etc.)
     */
    public function updateStatus(Request $request, $activityId)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:proposed,active,completed,cancelled,archived',
            'notes' => 'nullable|string',
            'actual_duration' => 'nullable|integer|min:1',
            'outcomes' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors(),
                'message' => 'Validation failed'
            ], 422);
        }

        $activity = CollaborativeActivity::find($activityId);
        if (!$activity) {
            return response()->json([
                'message' => 'Activity not found'
            ], 404);
        }

        // Check if user is creator or space owner
        if ($activity->created_by !== auth()->id()) {
            $space = CollaborationSpace::find($activity->space_id);
            if ($space->creator_id !== auth()->id()) {
                return response()->json([
                    'message' => 'You are not authorized to update this activity'
                ], 403);
            }
        }

        DB::beginTransaction();
        try {
            $oldStatus = $activity->status;
            $newStatus = $request->status;
            
            $activity->update([
                'status' => $newStatus,
                'notes' => $request->notes,
                'actual_duration' => $request->actual_duration,
                'outcomes' => $request->outcomes,
            ]);

            // Update timestamps based on status
            switch ($newStatus) {
                case 'active':
                    $activity->update(['started_at' => now()]);
                    break;
                case 'completed':
                    $activity->update(['completed_at' => now()]);
                    break;
                case 'cancelled':
                    $activity->update(['cancelled_at' => now()]);
                    break;
            }

            // Update space metrics
            $space = CollaborationSpace::find($activity->space_id);
            if ($space) {
                $activityMetrics = $space->activity_metrics ?? [];
                
                if ($oldStatus !== 'completed' && $newStatus === 'completed') {
                    $activityMetrics['completed_activities'] = ($activityMetrics['completed_activities'] ?? 0) + 1;
                    $activityMetrics['total_activity_duration'] = ($activityMetrics['total_activity_duration'] ?? 0) + ($request->actual_duration ?? $activity->suggested_duration);
                }
                
                if ($newStatus === 'active') {
                    $space->update(['current_focus' => $activity->title]);
                } elseif ($oldStatus === 'active' && $newStatus !== 'active') {
                    $space->update(['current_focus' => null]);
                }
                
                $space->update(['activity_metrics' => $activityMetrics]);
            }

            DB::commit();

            return response()->json([
                'activity' => $activity->fresh(['creator', 'participants']),
                'space' => $space ? $space->fresh(['participants.user']) : null,
                'message' => "Activity status updated to {$newStatus}"
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error updating activity status: ' . $e->getMessage());
            
            return response()->json([
                'message' => 'Failed to update activity status',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Add or remove participants from activity
     */
    public function updateParticipants(Request $request, $activityId)
    {
        $validator = Validator::make($request->all(), [
            'participant_ids' => 'required|array',
            'participant_ids.*' => 'exists:users,id',
            'action' => 'required|in:add,remove,set',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors(),
                'message' => 'Validation failed'
            ], 422);
        }

        $activity = CollaborativeActivity::find($activityId);
        if (!$activity) {
            return response()->json([
                'message' => 'Activity not found'
            ], 404);
        }

        // Check if user is creator or space owner
        if ($activity->created_by !== auth()->id()) {
            $space = CollaborationSpace::find($activity->space_id);
            if ($space->creator_id !== auth()->id()) {
                return response()->json([
                    'message' => 'You are not authorized to update participants'
                ], 403);
            }
        }

        try {
            switch ($request->action) {
                case 'add':
                    $activity->participants()->syncWithoutDetaching($request->participant_ids);
                    break;
                case 'remove':
                    $activity->participants()->detach($request->participant_ids);
                    break;
                case 'set':
                    $activity->participants()->sync($request->participant_ids);
                    break;
            }

            return response()->json([
                'activity' => $activity->load('participants'),
                'participant_count' => $activity->participants()->count(),
                'message' => 'Participants updated successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error updating activity participants: ' . $e->getMessage());
            
            return response()->json([
                'message' => 'Failed to update participants',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Get activity statistics for a space
     */
    public function getSpaceStatistics($spaceId)
    {
        $space = CollaborationSpace::find($spaceId);
        if (!$space) {
            return response()->json([
                'statistics' => [],
                'message' => 'Space not found'
            ], 404);
        }

        // Check if user is a participant
        $isParticipant = SpaceParticipation::where('space_id', $space->id)
            ->where('user_id', auth()->id())
            ->exists();
        
        if (!$isParticipant && $space->creator_id !== auth()->id()) {
            return response()->json([
                'statistics' => [],
                'message' => 'You are not a participant in this space'
            ], 403);
        }

        $statistics = [
            'total_activities' => CollaborativeActivity::where('space_id', $spaceId)->count(),
            'completed_activities' => CollaborativeActivity::where('space_id', $spaceId)
                ->where('status', 'completed')
                ->count(),
            'active_activities' => CollaborativeActivity::where('space_id', $spaceId)
                ->where('status', 'active')
                ->count(),
            'proposed_activities' => CollaborativeActivity::where('space_id', $spaceId)
                ->where('status', 'proposed')
                ->count(),
            'average_duration' => CollaborativeActivity::where('space_id', $spaceId)
                ->where('status', 'completed')
                ->whereNotNull('actual_duration')
                ->avg('actual_duration') ?? 0,
            'most_active_participants' => DB::table('collaborative_activity_user')
                ->join('collaborative_activities', 'collaborative_activity_user.collaborative_activity_id', '=', 'collaborative_activities.id')
                ->where('collaborative_activities.space_id', $spaceId)
                ->select('collaborative_activity_user.user_id', DB::raw('COUNT(*) as activity_count'))
                ->groupBy('collaborative_activity_user.user_id')
                ->orderBy('activity_count', 'desc')
                ->limit(5)
                ->get(),
            'activity_types' => CollaborativeActivity::where('space_id', $spaceId)
                ->select('activity_type', DB::raw('COUNT(*) as count'))
                ->groupBy('activity_type')
                ->orderBy('count', 'desc')
                ->get(),
        ];

        return response()->json([
            'statistics' => $statistics,
            'space_id' => $spaceId,
            'generated_at' => now()->toISOString(),
        ]);
    }
}