<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment4;

use App\Services\Dialectical\AxiomEngine\CAS\AbstractSymbolicEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoArithmeticEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoSuccessorLogic;

class UniversalPowerEngine extends AbstractSymbolicEngine
{
    private BinomialExpander $binomialExpander;
    private ExponentRulesReducer $exponentRules;
    private PeanoArithmeticEngine $arithmetic;
    private PeanoSuccessorLogic $peano;

    public function __construct(\App\Services\Dialectical\AxiomEngine\AxiomRegistry $registry)
    {
        parent::__construct($registry);
        $this->arithmetic = new PeanoArithmeticEngine($registry);
        $this->binomialExpander = new BinomialExpander($this->arithmetic);
        $this->exponentRules = new ExponentRulesReducer();
        $this->peano = new PeanoSuccessorLogic();
    }

    public function ingest(array $astNode): SymbolicExpression
    {
        return new SymbolicExpression();
    }

    /**
     * Expands an entire SymbolicExpression raised to a power.
     * E.g., (2x + 3)^2 => 4x^2 + 12x + 9
     */
    public function expandExpressionToPower(SymbolicExpression $expr, int $power): SymbolicExpression
    {
        if ($power === 0) {
            return new SymbolicExpression([new SymbolicTerm(1, [])]);
        }
        
        if ($power === 1) {
            return clone $expr;
        }

        // Single term: use exponent rules (c^n * x^mn)
        if (count($expr->terms) === 1) {
            return new SymbolicExpression([
                $this->exponentRules->powerOfTerm($expr->terms[0], $power)
            ]);
        }

        // Binomial: use Pascal's combinatorial expansion natively
        if (count($expr->terms) === 2) {
            return $this->binomialExpander->expand($expr->terms[0], $expr->terms[1], $power);
        }

        // Multinomials: recursively multiply the expression by itself $power times
        $result = clone $expr;
        for ($i = 1; $i < $power; $i = $this->peano->successor($i)) {
            $result = $this->arithmetic->multiplyExpressions($result, $expr);
        }
        
        return $result;
    }
}
