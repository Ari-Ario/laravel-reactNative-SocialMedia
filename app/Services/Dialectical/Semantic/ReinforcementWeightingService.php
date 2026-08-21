<?php

namespace App\Services\Dialectical\Semantic;

use App\Models\KnowledgeAxiom;

class ReinforcementWeightingService
{
    /**
     * Executes Total Reinforcement Inductive Weighting from Daily-Quest-Master logic.
     * Increases the confidence score of an axiom when it is repeatedly used successfully.
     */
    public function reinforceAxiom(int $axiomId)
    {
        $axiom = KnowledgeAxiom::find($axiomId);
        if (!$axiom) {
            return;
        }

        // Apply a sigmoidal/asymptotic reinforcement learning curve (approaching 1.0)
        // Current score + (Remaining Gap * Reinforcement Rate)
        $reinforcementRate = 0.05; // 5% step
        $currentScore = $axiom->confidence_score;
        
        $newScore = $currentScore + ((1.0 - $currentScore) * $reinforcementRate);

        // Cap at 1.0
        if ($newScore > 1.0) {
            $newScore = 1.0;
        }

        $axiom->confidence_score = $newScore;
        $axiom->save();
    }
}
