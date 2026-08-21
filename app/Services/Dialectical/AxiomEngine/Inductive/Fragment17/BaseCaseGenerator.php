<?php

namespace App\Services\Dialectical\AxiomEngine\Inductive\Fragment17;

use App\Services\Dialectical\AxiomEngine\CAS\AbstractSymbolicEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicEquation;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoArithmeticEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoSuccessorLogic;

/**
 * Fragment 17: Base Case Hypothesis Generation
 * Anchors the mathematical induction chain by formulating the base case P(1).
 */
class BaseCaseGenerator extends AbstractSymbolicEngine
{
    private PeanoArithmeticEngine $arithmeticEngine;
    private PeanoSuccessorLogic $peanoLogic;

    public function __construct(\App\Services\Dialectical\AxiomEngine\AxiomRegistry $registry = null)
    {
        if ($registry === null) {
            $compiler = new \App\Services\Dialectical\AxiomEngine\DynamicAxiomCompiler();
            $registry = new \App\Services\Dialectical\AxiomEngine\AxiomRegistry($compiler);
        }
        parent::__construct($registry);
        $this->arithmeticEngine = new PeanoArithmeticEngine($registry);
        $this->peanoLogic = new PeanoSuccessorLogic();
    }

    public function ingest(array $astNode): SymbolicExpression
    {
        return new SymbolicExpression();
    }

    /**
     * Evaluates a symbolic equation at a specific variable value.
     */
    public function evaluateBaseCase(SymbolicEquation $equation, string $targetVariable, int $baseValue = 1): bool
    {
        $lhsEval = $this->evaluateExpression($equation->lhs, $targetVariable, $baseValue);
        $rhsEval = $this->evaluateExpression($equation->rhs, $targetVariable, $baseValue);

        // Prove LHS == RHS structurally
        $difference = $this->arithmeticEngine->subtractExpressions($lhsEval, $rhsEval);

        // If difference evaluates to 0, they are equal
        return (string)$difference === "0";
    }

    /**
     * Substitutes a variable with an integer value and fully evaluates the constant.
     */
    public function evaluateExpression(SymbolicExpression $expr, string $variable, int $value): SymbolicExpression
    {
        $result = new SymbolicExpression();

        foreach ($expr->terms as $term) {
            $newVars = $term->variables;
            $coeff = $term->coefficient;

            if (isset($newVars[$variable])) {
                $exponent = $newVars[$variable];
                
                // compute value^exponent using Peano Logic (no native math!)
                $multiplier = 1;
                $i = 0;
                while ($i < $exponent) {
                    $multiplier = $this->peanoLogic->multiply($multiplier, $value);
                    $i = $this->peanoLogic->successor($i);
                }

                // Update coefficient
                $coeff = $this->peanoLogic->multiply($coeff, $multiplier);
                unset($newVars[$variable]);
            }

            // Create substituted term
            $newTerm = new SymbolicTerm($coeff, $newVars);
            
            // Add to new expression using arithmetic engine to collect like terms
            $result = $this->arithmeticEngine->addExpressions($result, new SymbolicExpression([$newTerm]));
        }

        return $result;
    }
}
