<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment8;

class PowerSetGenerator
{
    /**
     * Recursively constructs the Power Set P(S) of a finite set up to computational limits.
     * Represents the ZFC Axiom of Power Set.
     * e.g., P({a, b}) = {{}, {a}, {b}, {a, b}}
     */
    public function generate(array $set): array
    {
        $results = [[]];
        
        foreach ($set as $element) {
            $newSubsets = [];
            foreach ($results as $subset) {
                $newSubset = $subset;
                $newSubset[] = $element;
                $newSubsets[] = $newSubset;
            }
            $results = array_merge($results, $newSubsets);
        }
        
        return $results;
    }
}
