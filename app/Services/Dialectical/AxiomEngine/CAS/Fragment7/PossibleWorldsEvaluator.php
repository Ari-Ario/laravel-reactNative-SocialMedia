<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment7;

class PossibleWorldsEvaluator
{
    /**
     * Evaluates Necessity (□): Must be true in ALL accessible possible worlds.
     * Evaluates via Kripke semantics over defined graph contexts.
     */
    public function evaluateNecessity(array $accessibleWorlds, \Closure $conditionEvaluator): bool
    {
        foreach ($accessibleWorlds as $worldContext) {
            if (!$conditionEvaluator($worldContext)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Evaluates Possibility (◇): Must be true in AT LEAST ONE accessible possible world.
     */
    public function evaluatePossibility(array $accessibleWorlds, \Closure $conditionEvaluator): bool
    {
        foreach ($accessibleWorlds as $worldContext) {
            if ($conditionEvaluator($worldContext)) {
                return true;
            }
        }
        return false;
    }
}
