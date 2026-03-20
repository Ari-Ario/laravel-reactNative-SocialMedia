<?php

namespace App\Http\Controllers;

use App\Services\ModerationEngine;
use App\Models\UserComplianceTrack;
use Illuminate\Http\Request;

class ModerationController extends Controller
{
    protected $moderationEngine;

    public function __construct(ModerationEngine $moderationEngine)
    {
        $this->moderationEngine = $moderationEngine;
    }

    /**
     * Quick AI check for real-time feedback (Shadow Check).
     */
    public function quickCheck(Request $request)
    {
        $request->validate([
            'text' => 'required|string|max:1000',
            'context' => 'nullable|string'
        ]);

        $analysis = $this->moderationEngine->analyzeContent(
            $request->text,
            $request->context ?? 'input_field'
        );

        return response()->json([
            'is_safe' => $analysis->recommended_action === 'none',
            'recommended_action' => $analysis->recommended_action,
            'scores' => [
                'fact' => $analysis->fact_score,
                'morality' => $analysis->morality_score,
                'malicious' => $analysis->malicious_intent_score
            ],
            'flags' => $analysis->ai_flags
        ]);
    }

    /**
     * Get the authenticated user's compliance status.
     */
    public function myCompliance()
    {
        $compliance = UserComplianceTrack::firstOrCreate(['user_id' => auth()->id()]);
        return response()->json($compliance);
    }
}
