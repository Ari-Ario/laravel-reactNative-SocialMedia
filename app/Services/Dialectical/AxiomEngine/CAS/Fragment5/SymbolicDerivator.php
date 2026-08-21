<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment5;

use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoArithmeticEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoSuccessorLogic;

class SymbolicDerivator
{
    private PeanoArithmeticEngine $arithmetic;
    private PeanoSuccessorLogic $peano;

    public function __construct(PeanoArithmeticEngine $arithmetic)
    {
        $this->arithmetic = $arithmetic;
        $this->peano = new PeanoSuccessorLogic();
    }

    /**
     * Applies the power rule algebraically to an expression without evaluating variables.
     * d/dx (cx^n) = c*n * x^(n-1)
     */
    public function derive(SymbolicExpression $expr, string $respectToVariable): SymbolicExpression
    {
        $derivative = new SymbolicExpression();

        foreach ($expr->terms as $term) {
            // If the term does not contain the variable, its derivative is 0
            if (!isset($term->variables[$respectToVariable])) {
                continue;
            }

            $power = $term->variables[$respectToVariable];
            
            // new coefficient = old_coeff * power (via Peano)
            $newCoeff = $this->peano->multiply($term->coefficient, $power);
            
            // new power = power - 1 (via Peano Predecessor)
            $newPower = $this->peano->predecessor($power);

            $newVars = $term->variables;
            if ($newPower === 0) {
                unset($newVars[$respectToVariable]);
            } else {
                $newVars[$respectToVariable] = $newPower;
            }

            $derivative->addTerm(new SymbolicTerm($newCoeff, $newVars));
        }

        return $this->arithmetic->simplifyExpression($derivative);
    }
}
