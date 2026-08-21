<?php

namespace App\Services\Dialectical\AxiomEngine\Inductive;

use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicEquation;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\AxiomRegistry;
use App\Services\Dialectical\AxiomEngine\Inductive\Fragment17\BaseCaseGenerator;
use App\Services\Dialectical\AxiomEngine\Inductive\Fragment18\UniversalScalingConstructor;
use App\Services\Dialectical\AxiomEngine\Inductive\Fragment19\StructuralInvarianceProver;
use App\Services\Dialectical\AxiomEngine\Inductive\Fragment20\AbsoluteClosureFormulator;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoArithmeticEngine;

class InductiveSynthesisOrchestrator
{
    private AxiomRegistry $registry;
    private BaseCaseGenerator $baseGenerator;
    private UniversalScalingConstructor $scalingConstructor;
    private StructuralInvarianceProver $invarianceProver;
    private AbsoluteClosureFormulator $formulator;
    private PeanoArithmeticEngine $arithmetic;

    public function __construct(AxiomRegistry $registry)
    {
        $this->registry = $registry;
        $this->baseGenerator = new BaseCaseGenerator($registry);
        $this->scalingConstructor = new UniversalScalingConstructor($registry);
        $this->invarianceProver = new StructuralInvarianceProver($registry);
        $this->formulator = new AbsoluteClosureFormulator($registry);
        $this->arithmetic = new PeanoArithmeticEngine($registry);
    }

    /**
     * Executes the full end-to-end 3-step dialectical induction.
     *
     * @param string $proofTitle The human-readable title of the proof.
     * @param SymbolicEquation $hypothesis The equation P(n) to prove.
     * @param string $inductionVar The variable to induce over (e.g., 'n').
     * @param int $baseValue The base case value (usually 1).
     * @param SymbolicExpression $delta The symbolic difference between the sums/sequences at k and k+1.
     * @return array Contains 'success' boolean and 'markdown' proof string.
     */
    public function orchestrate(
        string $proofTitle,
        SymbolicEquation $baseCaseEquation,
        SymbolicExpression $hypothesisRhs,
        string $inductionVar,
        int $baseValue,
        SymbolicExpression $delta
    ): array {
        // Step 1: Base Case Evaluation
        $baseValid = $this->baseGenerator->evaluateBaseCase($baseCaseEquation, $inductionVar, $baseValue);

        if (!$baseValid) {
            return [
                'success' => false,
                'markdown' => $this->formulator->formulateInductiveProof(
                    $proofTitle, $baseCaseEquation, false, $baseCaseEquation, $baseCaseEquation, false
                )
            ];
        }

        // Step 2: Synthesize Inductive Hypothesis P(k) and P(k+1)
        // Assume induction over a new variable 'k'
        $kExpr = new SymbolicExpression([
            new \App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm(1, ['k' => 1])
        ]);
        
        $kPlus1Expr = new SymbolicExpression([
            new \App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm(1, ['k' => 1]),
            new \App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm(1, [])
        ]);

        // Construct P(k) by substituting n -> k on the RHS
        $pkRhsRaw = $this->scalingConstructor->scaleVariable($hypothesisRhs, $inductionVar, $kExpr);
        $pkRhs = $this->arithmetic->addExpressions($pkRhsRaw, new SymbolicExpression());

        // Construct P(k+1) by substituting n -> k+1 on the RHS
        $pkPlus1RhsRaw = $this->scalingConstructor->scaleVariable($hypothesisRhs, $inductionVar, $kPlus1Expr);
        $pkPlus1Rhs = $this->arithmetic->addExpressions($pkPlus1RhsRaw, new SymbolicExpression());

        // Prepare dummy equations for the formulator
        $pkEquation = new SymbolicEquation(
            new SymbolicExpression([new \App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm(1, ['k' => 1])]), 
            "=",
            $pkRhs
        );
        $pkPlus1Equation = new SymbolicEquation(
            new SymbolicExpression([new \App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm(1, ['k' => 2])]),
            "=",
            $pkPlus1Rhs
        );

        // Step 3: Structural Invariance Proof
        // Prove that RHS(k) + Delta == RHS(k+1)
        $invarianceValid = $this->invarianceProver->proveInvariance($pkRhs, $delta, $pkPlus1Rhs);

        // Formulate Absolute Closure
        $markdown = $this->formulator->formulateInductiveProof(
            $proofTitle,
            $baseCaseEquation,
            $baseValid,
            $pkEquation,
            $pkPlus1Equation,
            $invarianceValid
        );

        return [
            'success' => $invarianceValid,
            'markdown' => $markdown
        ];
    }
}
