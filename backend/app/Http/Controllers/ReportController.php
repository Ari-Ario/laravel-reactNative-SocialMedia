<?php

namespace App\Http\Controllers;

use App\Models\ModerationReport;
use App\Models\ModerationCheck;
use App\Models\Post;
use App\Models\User;
use App\Models\CollaborationSpace;
use App\Models\Comment;
use App\Models\Story;
use App\Models\UserRestriction;
use App\Services\ModerationEngine;
use App\Notifications\ViolationReported;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ReportController extends Controller
{
    protected $moderationEngine;

    public function __construct(ModerationEngine $moderationEngine)
    {
        $this->moderationEngine = $moderationEngine;
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|in:post,user,comment,space,story',
            'targetId' => 'required',
            'categoryId' => 'required|string',
            'subcategoryId' => 'required|string',
            'description' => 'nullable|string|max:500',
            'evidence' => 'nullable|array',
            'isAnonymous' => 'boolean',
            'isUrgent' => 'boolean',
            'metadata' => 'nullable|array'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            // 1. Verify Target Exists & Get Content for AI Analysis
            $content = $this->getTargetContent($request->type, $request->targetId);
            if (!$content) {
                return response()->json(['error' => 'Target not found'], 404);
            }

            // 2. Perform AI Content Analysis (Fact-Check & Morality)
            $check = $this->moderationEngine->analyzeContent(
                $content['text'], 
                $request->type, 
                $request->targetId,
                false // Disable auto-report since we are creating one manually below
            );


            // 3. Detect Reporting Bias (Harassment detection)
            $biasAnalysis = $this->moderationEngine->evaluateReportingBias(
                auth()->id(),
                $request->targetId,
                $request->type
            );

            // 4. Determine Severity & Create Report
            $severity = $this->calculateSeverity($check, $request->isUrgent);
            
            $reportData = [
                'report_id' => 'REP-' . strtoupper(Str::random(4)) . '-' . rand(1000, 9999),
                'reporter_id' => $request->isAnonymous ? null : auth()->id(),
                'target_type' => $request->type,
                'target_id' => is_numeric($request->targetId) ? $request->targetId : 0, // Fallback for UUIDs
                'category' => $request->categoryId,
                'subcategory' => $request->subcategoryId,
                'description' => $request->description,
                'evidence' => $request->evidence,
                'severity' => $severity,
                'status' => $biasAnalysis['bias_score'] > 0.7 ? 'dismissed' : 'pending',
                'check_id' => $check->id,
                'reporting_bias_score' => $biasAnalysis['bias_score'],
                'metadata' => array_merge($request->metadata ?? [], [
                    'ip' => $request->ip(),
                    'ua' => $request->userAgent()
                ])
            ];

            // If targetId is a UUID, store it in metadata since the column is BigInt
            if (!is_numeric($request->targetId)) {
                $reportData['metadata']['actual_target_id'] = $request->targetId;
            }

            $report = ModerationReport::create($reportData);


            // 5. Automated Protected Action
            if ($report->status !== 'dismissed' && $severity === 'critical') {
                $this->autoEscalate($report, $check);
            }

            // 6. Notify Admins for High/Critical intensity
            if ($report->status === 'pending' && ($severity === 'high' || $severity === 'critical')) {
                $admins = User::where('is_admin', true)->get();
                foreach ($admins as $admin) {
                    $admin->notify(new ViolationReported($report));
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'reportId' => $report->report_id,
                'severity' => $severity,
                'status' => $report->status,
                'ai_analysis' => [
                    'fact_score' => $check->fact_score,
                    'malicious_intent_score' => $check->malicious_intent_score,
                    'is_flagged' => $check->recommended_action !== 'none'
                ],
                'message' => $report->status === 'dismissed' 
                    ? 'Report flagged for potential bias and suppressed.' 
                    : 'Report submitted successfully for AI review.'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Moderation Engine Error: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to process moderation request: ' . $e->getMessage()], 500);
        }
    }

    private function getTargetContent($type, $id)
    {
        $target = null;
        $text = '';

        switch ($type) {
            case 'post':
                $target = Post::find($id);
                $text = $target ? ($target->caption ?? '') : '';
                break;
            case 'user':
                $target = User::find($id);
                $text = $target ? ($target->bio ?? $target->name ?? '') : '';
                break;
            case 'comment':
                $target = Comment::find($id);
                $text = $target ? ($target->content ?? '') : '';
                break;
            case 'space':
                $target = CollaborationSpace::find($id);
                $text = $target ? (($target->title ?? '') . ' ' . ($target->description ?? '')) : '';
                break;
            case 'story':
                $target = Story::find($id);
                $text = $target ? ($target->caption ?? 'Story media content') : '';
                break;
        }

        return $target ? ['model' => $target, 'text' => $text] : null;
    }

    private function calculateSeverity($check, $isUrgent)
    {
        if ($check->malicious_intent_score > 0.9) return 'critical';
        if ($check->malicious_intent_score > 0.6 || $isUrgent) return 'high';
        if ($check->fact_score < 0.4) return 'medium';
        return 'low';
    }

    private function autoEscalate($report, $check)
    {
        $report->update(['status' => 'reviewing']);
        
        // Find the user to restrict (the author of the content)
        $userIdToRestrict = null;
        if ($report->target_type === 'user') {
            $userIdToRestrict = $report->target_id;
        } else {
            $targetContent = $this->getTargetContent($report->target_type, $report->target_id);
            if ($targetContent && isset($targetContent['model'])) {
                $userIdToRestrict = $targetContent['model']->user_id ?? $targetContent['model']->user?->id ?? $targetContent['model']->creator_id ?? null;
            }
        }

        // Auto-restrict if AI is extremely confident about malicious intent and we found a user
        if ($userIdToRestrict && $check->malicious_intent_score > 0.95) {
            UserRestriction::create([
                'user_id' => $userIdToRestrict,
                'type' => 'warning',
                'reason' => 'AI detected severe policy violation on ' . $report->target_type,
                'duration_hours' => 24,
                'expires_at' => now()->addHours(24)
            ]);
        }
    }


    public function status($reportId)
    {
        $report = ModerationReport::where('report_id', $reportId)->firstOrFail();
        return response()->json($report);
    }
}