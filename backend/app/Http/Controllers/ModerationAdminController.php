<?php

namespace App\Http\Controllers;

use App\Models\ModerationReport;
use App\Models\UserRestriction;
use App\Models\UserComplianceTrack;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ModerationAdminController extends Controller
{
    /**
     * Get a list of reports that need attention.
     */
    public function index(Request $request)
    {
        // Simple admin check (can be replaced with middleware)
        if (!auth()->user()->is_admin) {
            return response()->json(['error' => 'Unauthorized. Admin access required.'], 403);
        }

        $query = ModerationReport::with(['reporter', 'check'])
            ->orderBy('created_at', 'desc');

        // Optional filtering
        if ($request->has('status')) {
            $query->where('status', $request->status);
        } else {
            $query->whereIn('status', ['pending', 'reviewing']);
        }

        if ($request->has('severity')) {
            $query->where('severity', $request->severity);
        }

        return response()->json($query->paginate(20));
    }

    /**
     * Resolve a report with a specific action.
     */
    public function resolve(Request $request, $reportId)
    {
        if (!auth()->user()->is_admin) {
            return response()->json(['error' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'action' => 'required|in:dismiss,warn,suspend,ban',
            'notes' => 'nullable|string|max:500',
            'duration_hours' => 'nullable|integer|min:1',
        ]);

        $report = ModerationReport::where('report_id', $reportId)->firstOrFail();

        try {
            DB::beginTransaction();

            $actionTaken = $request->action;
            $status = ($request->action === 'dismiss') ? 'dismissed' : 'resolved';

            Log::info("Admin Resolve: Report {$reportId}, Action: {$actionTaken}, Status: {$status}");

            // 1. Update report status
            $report->update([
                'status' => $status,
                'action_taken' => $actionTaken,
                'resolved_at' => now(),
                'metadata' => array_merge($report->metadata ?? [], [
                    'moderator_notes' => $request->notes,
                    'moderator_id' => auth()->id()
                ])
            ]);

            // 2. Apply restriction to the target user if NOT dismissed
            if ($actionTaken !== 'dismiss') {
                $targetUserId = $this->getTargetUserId($report);
                Log::info("Admin Resolve: Target User ID identified as: " . ($targetUserId ?? 'NULL'));
                
                if ($targetUserId) {
                    $restriction = UserRestriction::create([
                        'user_id' => $targetUserId,
                        'type' => $this->mapActionToRestrictionType($actionTaken),
                        'reason' => $request->notes ?? 'Administrative action following report: ' . $reportId,
                        'duration_hours' => $request->duration_hours,
                        'expires_at' => $request->duration_hours ? now()->addHours($request->duration_hours) : null,
                        'moderator_id' => auth()->id(),
                    ]);
                    
                    Log::info("Admin Resolve: UserRestriction created with ID: {$restriction->id}");

                    // Update user compliance track
                    $track = UserComplianceTrack::firstOrCreate(['user_id' => $targetUserId]);
                    $track->increment('violation_count');
                    $track->decrement('trust_score', 0.1);
                    $track->save();
                    
                    Log::info("Admin Resolve: UserComplianceTrack updated for User: {$targetUserId}");
                } else {
                    Log::warning("Admin Resolve: Action requested but no target user could be identified for report {$reportId}");
                }
            } else {
                // If dismissed, check if the reporter was being malicious (false flagging)
                if ($report->reporting_bias_score > 0.6) {
                    $reporterTrack = UserComplianceTrack::firstOrCreate(['user_id' => $report->reporter_id]);
                    $reporterTrack->increment('false_report_count');
                    $reporterTrack->decrement('reporting_integrity', 0.15);
                    $reporterTrack->save();
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Report resolved with action: ' . $actionTaken
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Admin Moderation Error: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to resolve report: ' . $e->getMessage()], 500);
        }
    }

    private function getTargetUserId($report)
    {
        if ($report->target_type === 'user') {
            return $report->target_id;
        }
        
        // Handle UUIDs stored in metadata (for spaces, etc.)
        $actualTargetId = $report->target_id;
        if (isset($report->metadata['actual_target_id'])) {
            $actualTargetId = $report->metadata['actual_target_id'];
        }

        // Find user by target model
        $modelClass = 'App\\Models\\' . ucfirst($report->target_type);
        if ($report->target_type === 'comment') $modelClass = 'App\\Models\\Comment';
        if ($report->target_type === 'space') $modelClass = 'App\\Models\\CollaborationSpace';

        try {
            $target = $modelClass::find($actualTargetId);
            if ($target) {
                // Return 'user_id' or 'creator_id' depending on model
                return $target->user_id ?? $target->creator_id ?? $target->user?->id ?? null;
            }
        } catch (\Exception $e) {
            Log::error("Error finding target user: " . $e->getMessage());
            return null;
        }

        return null;
    }


    private function mapActionToRestrictionType($action)
    {
        return match($action) {
            'warn' => 'warning',
            'suspend' => 'suspension',
            'ban' => 'ban',
            default => 'warning'
        };
    }
}
