<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment7;

use App\Services\Dialectical\AxiomEngine\CAS\AbstractSymbolicEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment6\PropositionalLogicEngine;

class FirstOrderModalEngine extends AbstractSymbolicEngine
{
    private QuantifierReducer $quantifierReducer;
    private PossibleWorldsEvaluator $possibleWorldsEvaluator;
    private PropositionalLogicEngine $propositionalEngine;

    public function __construct(\App\Services\Dialectical\AxiomEngine\AxiomRegistry $registry)
    {
        parent::__construct($registry);
        $this->propositionalEngine = new PropositionalLogicEngine($registry);
        $this->quantifierReducer = new QuantifierReducer($this->propositionalEngine);
        $this->possibleWorldsEvaluator = new PossibleWorldsEvaluator();
    }

    public function ingest(array $astNode): SymbolicExpression
    {
        return new SymbolicExpression();
    }
    
    /**
     * Interface to resolve ∀ constraint.
     */
    public function forAll(string $variable, array $domain, \Closure $condition): bool
    {
        return $this->quantifierReducer->reduceUniversal($variable, $domain, $condition);
    }
    
    /**
     * Interface to resolve ∃ constraint.
     */
    public function exists(string $variable, array $domain, \Closure $condition): bool
    {
        return $this->quantifierReducer->reduceExistential($variable, $domain, $condition);
    }
    
    /**
     * Interface to resolve □ modality constraint.
     */
    public function necessarily(array $accessibleWorlds, \Closure $condition): bool
    {
        return $this->possibleWorldsEvaluator->evaluateNecessity($accessibleWorlds, $condition);
    }
    
    /**
     * Interface to resolve ◇ modality constraint.
     */
    public function possibly(array $accessibleWorlds, \Closure $condition): bool
    {
        return $this->possibleWorldsEvaluator->evaluatePossibility($accessibleWorlds, $condition);
    }
}
