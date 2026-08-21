<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment8;

use App\Services\Dialectical\AxiomEngine\CAS\AbstractSymbolicEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment7\FirstOrderModalEngine;

class ZfcSetTheoryEngine extends AbstractSymbolicEngine
{
    private PowerSetGenerator $powerSetGenerator;
    private AxiomOfSeparationFilter $axiomOfSeparation;
    private FirstOrderModalEngine $modalEngine;

    public function __construct(\App\Services\Dialectical\AxiomEngine\AxiomRegistry $registry)
    {
        parent::__construct($registry);
        $this->modalEngine = new FirstOrderModalEngine($registry);
        $this->powerSetGenerator = new PowerSetGenerator();
        $this->axiomOfSeparation = new AxiomOfSeparationFilter($this->modalEngine);
    }

    public function ingest(array $astNode): SymbolicExpression
    {
        return new SymbolicExpression();
    }

    /**
     * Set Union (∪)
     */
    public function union(array $setA, array $setB): array
    {
        $result = $setA;
        foreach ($setB as $item) {
            if (!in_array($item, $result, true)) {
                $result[] = $item;
            }
        }
        return $result;
    }

    /**
     * Set Intersection (∩)
     */
    public function intersection(array $setA, array $setB): array
    {
        $result = [];
        foreach ($setA as $item) {
            if (in_array($item, $setB, true)) {
                $result[] = $item;
            }
        }
        return $result;
    }
    
    /**
     * Set Difference (\)
     */
    public function difference(array $setA, array $setB): array
    {
        $result = [];
        foreach ($setA as $item) {
            if (!in_array($item, $setB, true)) {
                $result[] = $item;
            }
        }
        return $result;
    }
    
    /**
     * Subset Evaluation (⊆)
     */
    public function isSubset(array $setA, array $setB): bool
    {
        foreach ($setA as $item) {
            if (!in_array($item, $setB, true)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Computes Power Set P(S)
     */
    public function powerSet(array $set): array
    {
        return $this->powerSetGenerator->generate($set);
    }
    
    /**
     * Applies Axiom of Separation to yield { x ∈ S | P(x) }
     */
    public function applyAxiomOfSeparation(string $variable, array $domain, \Closure $condition): array
    {
        return $this->axiomOfSeparation->filter($variable, $domain, $condition);
    }
}
