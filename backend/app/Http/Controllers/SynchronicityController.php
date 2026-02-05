<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\CollaborationSpace;
use App\Models\User;

class SynchronicityController extends Controller
{
    public function findMatches(Request $request)
    {
        $request->validate([
            'space_id' => 'required|string',
            'participants' => 'sometimes|array',
        ]);
        
        $space = CollaborationSpace::find($request->space_id);
        if (!$space) {
            return response()->json(['matches' => []]);
        }
        
        $matches = [];
        
        // 1. Time-based matches
        $hour = now()->hour;
        if ($hour >= 9 && $hour <= 11) {
            $matches[] = [
                'type' => 'timing',
                'matchId' => 'morning_peak_' . now()->timestamp,
                'score' => 0.8,
                'confidence' => 0.9,
                'data' => [
                    'hour' => $hour,
                    'suggestion' => 'Morning creative session',
                ],
                'description' => 'Perfect time for morning creativity boost',
            ];
        }
        
        // 2. Participant skill matches
        $participants = $request->participants ?? [];
        if (count($participants) >= 2) {
            $skillSets = [];
            foreach ($participants as $participant) {
                if (isset($participant['user']['preferences']['synergy_traits'])) {
                    $skillSets = array_merge($skillSets, $participant['user']['preferences']['synergy_traits']);
                }
            }
            
            $uniqueSkills = array_unique($skillSets);
            if (count($uniqueSkills) >= 2) {
                $matches[] = [
                    'type' => 'user',
                    'matchId' => 'skill_synergy_' . now()->timestamp,
                    'score' => 0.85,
                    'confidence' => 0.9,
                    'data' => [
                        'skills' => $uniqueSkills,
                        'participant_count' => count($participants),
                    ],
                    'description' => 'Complementary skill sets detected - great for collaboration!',
                ];
            }
        }
        
        // 3. Space activity matches
        $activityMetrics = $space->activity_metrics ?? [];
        if (isset($activityMetrics['message_count']) && $activityMetrics['message_count'] > 10) {
            $matches[] = [
                'type' => 'pattern',
                'matchId' => 'high_activity_' . now()->timestamp,
                'score' => 0.75,
                'confidence' => 0.8,
                'data' => [
                    'pattern' => 'high_engagement',
                    'message_count' => $activityMetrics['message_count'],
                ],
                'description' => 'High engagement detected - consider a focused session',
            ];
        }
        
        return response()->json([
            'matches' => $matches,
            'space_id' => $space->id,
            'generated_at' => now()->toISOString(),
        ]);
    }
    
    public function storeEvent(Request $request)
    {
        $request->validate([
            'space_id' => 'required|string',
            'match' => 'required|array',
            'type' => 'required|string',
        ]);
        
        // Store in database if you have a table, or just log
        \Log::info('Synchronicity event triggered', [
            'space_id' => $request->space_id,
            'type' => $request->type,
            'user_id' => auth()->id(),
            'match' => $request->match,
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'Event logged successfully',
            'event_id' => 'sync_' . now()->timestamp,
        ]);
    }
    
    public function getSpaceMatches($spaceId)
    {
        $space = CollaborationSpace::find($spaceId);
        if (!$space) {
            return response()->json(['matches' => []]);
        }
        
        // Return cached or generate new matches
        return response()->json([
            'matches' => [],
            'space_id' => $spaceId,
        ]);
    }
}