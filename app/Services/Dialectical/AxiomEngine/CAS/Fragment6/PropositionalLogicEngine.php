<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment6;

use App\Services\Dialectical\AxiomEngine\CAS\AbstractSymbolicEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;

class PropositionalLogicEngine extends AbstractSymbolicEngine
{
    private TruthTableGenerator $truthTableGenerator;

    public function __construct(\App\Services\Dialectical\AxiomEngine\AxiomRegistry $registry)
    {
        parent::__construct($registry);
        $this->truthTableGenerator = new TruthTableGenerator();
    }

    public function ingest(array $astNode): SymbolicExpression
    {
        return new SymbolicExpression();
    }

    /**
     * Evaluates a basic logic gate based on Truth values.
     */
    public function evaluateGate(string $gate, bool $a, bool $b = false): bool
    {
        switch (strtoupper($gate)) {
            case 'AND': return $a && $b;
            case 'OR': return $a || $b;
            case 'NOT': return !$a;
            case 'IMPLIES': return !$a || $b; // A -> B is logically equivalent to !A || B
            case 'EQUIVALENT': return $a === $b; // A <-> B
            case 'XOR': return $a !== $b;
            default: throw new \InvalidArgumentException("Unknown logical gate: $gate");
        }
    }
    
    /**
     * Checks if a statement evaluated across all truth states is a tautology (always true).
     */
    public function isTautology(array $variables, \Closure $expressionEvaluator): bool
    {
        $states = $this->truthTableGenerator->generateStates($variables);
        foreach ($states as $state) {
            if (!$expressionEvaluator($state)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Checks if a statement is a contradiction (always false).
     */
    public function isContradiction(array $variables, \Closure $expressionEvaluator): bool
    {
        $states = $this->truthTableGenerator->generateStates($variables);
        foreach ($states as $state) {
            if ($expressionEvaluator($state)) {
                return false;
            }
        }
        return true;
    }
}
