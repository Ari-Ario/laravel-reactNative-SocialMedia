<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment7;

use App\Services\Dialectical\AxiomEngine\CAS\Fragment6\PropositionalLogicEngine;

class QuantifierReducer
{
    private PropositionalLogicEngine $propositionalEngine;

    public function __construct(PropositionalLogicEngine $propositionalEngine)
    {
        $this->propositionalEngine = $propositionalEngine;
    }

    /**
     * Reduces Universal Quantifier (∀): ∀x ∈ Domain, P(x)
     * To a conjunction (AND) over the domain.
     */
    public function reduceUniversal(string $variable, array $domain, \Closure $conditionEvaluator): bool
    {
        // For a true symbolic CAS, this would build an AST of ANDs.
        // For this hybrid engine, we evaluate to ensure no counter-examples.
        foreach ($domain as $value) {
            $worldState = [$variable => $value];
            if (!$conditionEvaluator($worldState)) {
                return false; 
            }
        }
        return true;
    }

    /**
     * Reduces Existential Quantifier (∃): ∃x ∈ Domain, P(x)
     * To a disjunction (OR) over the domain.
     */
    public function reduceExistential(string $variable, array $domain, \Closure $conditionEvaluator): bool
    {
        foreach ($domain as $value) {
            $worldState = [$variable => $value];
            if ($conditionEvaluator($worldState)) {
                return true; 
            }
        }
        return false;
    }
}
