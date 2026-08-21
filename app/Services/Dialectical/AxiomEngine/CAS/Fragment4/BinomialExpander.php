<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment4;

use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicTerm;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoArithmeticEngine;
use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoSuccessorLogic;

class BinomialExpander
{
    private CombinatoricsSynthesizer $combinatorics;
    private ExponentRulesReducer $exponentRules;
    private PeanoArithmeticEngine $arithmetic;
    private PeanoSuccessorLogic $peano;

    public function __construct(PeanoArithmeticEngine $arithmetic)
    {
        $this->combinatorics = new CombinatoricsSynthesizer();
        $this->exponentRules = new ExponentRulesReducer();
        $this->arithmetic = $arithmetic;
        $this->peano = new PeanoSuccessorLogic();
    }

    /**
     * Expands (a + b)^n natively using Pascal's combinatorial expansion:
     * sum from k=0 to n of [ nCk * a^(n-k) * b^k ]
     */
    public function expand(SymbolicTerm $a, SymbolicTerm $b, int $n): SymbolicExpression
    {
        $result = new SymbolicExpression();

        for ($k = 0; $k <= $n; $k = $this->peano->successor($k)) {
            // Coefficient nCk
            $nCk = $this->combinatorics->combination($n, $k);
            
            // a^(n-k)
            $nMinusK = $this->peano->add($n, $this->peano->negate($k));
            $termA = $this->exponentRules->powerOfTerm($a, $nMinusK);
            
            // b^k
            $termB = $this->exponentRules->powerOfTerm($b, $k);
            
            // Multiply a^(n-k) * b^k
            $exprA = new SymbolicExpression([$termA]);
            $exprB = new SymbolicExpression([$termB]);
            
            $productExpr = $this->arithmetic->multiplyExpressions($exprA, $exprB);
            
            // Multiply the nCk coefficient into the final result
            $nCkExpr = new SymbolicExpression([new SymbolicTerm($nCk, [])]);
            $finalTermExpr = $this->arithmetic->multiplyExpressions($nCkExpr, $productExpr);
            
            foreach ($finalTermExpr->terms as $t) {
                $result->addTerm($t);
            }
        }

        return $this->arithmetic->simplifyExpression($result);
    }
}
