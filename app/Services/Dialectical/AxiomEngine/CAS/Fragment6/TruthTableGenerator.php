<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment6;

class TruthTableGenerator
{
    /**
     * Generates a full state-space matrix of 2^n combinations for n propositional variables.
     */
    public function generateStates(array $variables): array
    {
        $n = count($variables);
        $totalStates = 1 << $n; // 2^n
        
        $states = [];
        for ($i = 0; $i < $totalStates; $i++) {
            $state = [];
            foreach ($variables as $index => $var) {
                // Determine if this variable is 1 or 0 in the current state
                // We use bitwise masking
                $bit = ($i >> ($n - 1 - $index)) & 1;
                $state[$var] = (bool)$bit;
            }
            $states[] = $state;
        }
        
        return $states;
    }
}
