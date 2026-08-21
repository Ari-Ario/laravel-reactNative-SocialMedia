<?php

namespace App\Services\Dialectical\AxiomEngine\Inductive\Fragment19;

use App\Services\Dialectical\AxiomEngine\CAS\AbstractSymbolicEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoArithmeticEngine;

/**
 * Fragment 19: Structural Invariance Prover
 * Proves that P(k) implies P(k+1) by confirming algebraic equivalence.
 */
class StructuralInvarianceProver extends AbstractSymbolicEngine
{
    private PeanoArithmeticEngine $arithmeticEngine;

    public function __construct(\App\Services\Dialectical\AxiomEngine\AxiomRegistry $registry = null)
    {
        if ($registry === null) {
            $compiler = new \App\Services\Dialectical\AxiomEngine\DynamicAxiomCompiler();
            $registry = new \App\Services\Dialectical\AxiomEngine\AxiomRegistry($compiler);
        }
        parent::__construct($registry);
        $this->arithmeticEngine = new PeanoArithmeticEngine($registry);
    }

    public function ingest(array $astNode): SymbolicExpression
    {
        return new SymbolicExpression();
    }

    /**
     * Proves the inductive step.
     * Assumes P(k) implies LHS_k = RHS_k.
     * To prove P(k+1), we know LHS_{k+1} = LHS_k + Delta.
     * Therefore, RHS_k + Delta must equal RHS_{k+1}.
     *
     * @param SymbolicExpression $rhsK The right-hand side of P(k)
     * @param SymbolicExpression $delta The additional term added to go from k to k+1
     * @param SymbolicExpression $rhsKPlus1 The right-hand side of P(k+1)
     * @return bool True if structurally invariant (i.e. RHS_k + Delta == RHS_{k+1})
     */
    public function proveInvariance(
        SymbolicExpression $rhsK,
        SymbolicExpression $delta,
        SymbolicExpression $rhsKPlus1
    ): bool {
        // Construct the inferred RHS for k+1: RHS_k + Delta
        $inferredRhs = $this->arithmeticEngine->addExpressions($rhsK, $delta);

        // Prove that the inferred RHS matches the constructed RHS for k+1
        $difference = $this->arithmeticEngine->subtractExpressions($inferredRhs, $rhsKPlus1);

        // If the algebraic difference evaluates to exactly 0, structural invariance holds
        return (string)$difference === "0";
    }
}
