<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment8;

use App\Services\Dialectical\AxiomEngine\CAS\Fragment7\FirstOrderModalEngine;

class AxiomOfSeparationFilter
{
    private FirstOrderModalEngine $modalEngine;

    public function __construct(FirstOrderModalEngine $modalEngine)
    {
        $this->modalEngine = $modalEngine;
    }

    /**
     * Filters a domain set through a condition to yield a valid subset.
     * Represents the ZFC Axiom Schema of Specification (Separation).
     * { x ∈ S | P(x) }
     */
    public function filter(string $variable, array $domain, \Closure $conditionEvaluator): array
    {
        $subset = [];
        foreach ($domain as $value) {
            $worldState = [$variable => $value];
            if ($conditionEvaluator($worldState)) {
                $subset[] = $value;
            }
        }
        return $subset;
    }
}
