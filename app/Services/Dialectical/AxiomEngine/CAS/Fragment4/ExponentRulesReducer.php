<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment4;

use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoSuccessorLogic;

class ExponentRulesReducer
{
    private PeanoSuccessorLogic $peano;

    public function __construct()
    {
        $this->peano = new PeanoSuccessorLogic();
    }

    /**
     * Applies the power rule to a single term: (cx^a)^b = c^b * x^(ab)
     */
    public function powerOfTerm(SymbolicTerm $term, int $power): SymbolicTerm
    {
        if ($power === 0) {
            return new SymbolicTerm(1, []);
        }

        // Calculate coefficient to the power without pow()
        $newCoeff = 1;
        for ($i = 0; $i < $power; $i = $this->peano->successor($i)) {
            $newCoeff = $this->peano->multiply($newCoeff, $term->coefficient);
        }

        // Calculate variable exponents natively
        $newVars = [];
        foreach ($term->variables as $v => $exp) {
            $newVars[$v] = $this->peano->multiply($exp, $power);
        }

        return new SymbolicTerm($newCoeff, $newVars);
    }
}
