<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment5;

use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoSuccessorLogic;

class EpsilonDeltaSynthesizer
{
    private PeanoSuccessorLogic $peano;

    public function __construct()
    {
        $this->peano = new PeanoSuccessorLogic();
    }

    /**
     * Symbolic evaluation of Limit: lim_{x -> c} f(x)
     * For continuous polynomials, we perform structural substitution mapping.
     */
    public function evaluateLimitContinuous(SymbolicExpression $expr, string $variable, int $targetValue): int
    {
        $result = 0;

        foreach ($expr->terms as $term) {
            $termValue = $term->coefficient;
            
            if (isset($term->variables[$variable])) {
                $power = $term->variables[$variable];
                
                // Calculate targetValue^power natively via Peano
                $poweredValue = 1;
                for ($i = 0; $i < $power; $i = $this->peano->successor($i)) {
                    $poweredValue = $this->peano->multiply($poweredValue, $targetValue);
                }
                
                $termValue = $this->peano->multiply($termValue, $poweredValue);
            }
            
            $result = $this->peano->add($result, $termValue);
        }

        return $result;
    }
}
