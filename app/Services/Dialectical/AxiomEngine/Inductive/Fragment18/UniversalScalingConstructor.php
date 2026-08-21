<?php

namespace App\Services\Dialectical\AxiomEngine\Inductive\Fragment18;

use App\Services\Dialectical\AxiomEngine\AxiomRegistry;
use App\Services\Dialectical\AxiomEngine\CAS\AbstractSymbolicEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoArithmeticEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment4\UniversalPowerEngine;

/**
 * Fragment 18: Universal Scaling Constructor
 * Synthesizes the Inductive Step P(k+1) by recursively substituting the bounding variable.
 */
class UniversalScalingConstructor extends AbstractSymbolicEngine
{
    private PeanoArithmeticEngine $arithmeticEngine;
    private UniversalPowerEngine $powerEngine;

    public function __construct(AxiomRegistry $registry = null)
    {
        if ($registry === null) {
            $compiler = new \App\Services\Dialectical\AxiomEngine\DynamicAxiomCompiler();
            $registry = new AxiomRegistry($compiler);
        }
        parent::__construct($registry);
        $this->arithmeticEngine = new PeanoArithmeticEngine($registry);
        $this->powerEngine = new UniversalPowerEngine($registry);
    }

    public function ingest(array $astNode): SymbolicExpression
    {
        return new SymbolicExpression();
    }

    /**
     * Substitutes a target variable (e.g., 'n') with an entire SymbolicExpression (e.g., k+1)
     */
    public function scaleVariable(SymbolicExpression $expr, string $targetVariable, SymbolicExpression $replacement): SymbolicExpression
    {
        $result = new SymbolicExpression();

        foreach ($expr->terms as $term) {
            $newVars = $term->variables;
            $coeff = $term->coefficient;

            if (isset($newVars[$targetVariable])) {
                $exponent = $newVars[$targetVariable];
                unset($newVars[$targetVariable]);

                // 1. Expand the replacement expression to the required power
                $expandedReplacement = $this->powerEngine->expandExpressionToPower($replacement, $exponent);

                // 2. Multiply the expanded replacement by the remaining part of the original term
                // Create a temporary term representing the rest of the term (coefficient * remaining vars)
                $restTerm = new SymbolicTerm($coeff, $newVars);
                $restExpr = new SymbolicExpression([$restTerm]);

                // Multiply them together
                $scaledTermExpr = $this->arithmeticEngine->multiplyExpressions($restExpr, $expandedReplacement);

                // 3. Add to the total result
                $result = $this->arithmeticEngine->addExpressions($result, $scaledTermExpr);
            } else {
                // If target variable not in term, just add the term as is
                $result = $this->arithmeticEngine->addExpressions($result, new SymbolicExpression([$term]));
            }
        }

        return $result;
    }
}
