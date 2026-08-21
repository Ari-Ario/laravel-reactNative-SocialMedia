<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment4;

use App\Services\Dialectical\AxiomEngine\CAS\Fragment3\PeanoSuccessorLogic;

/**
 * Derives combinatorial values entirely through Peano recursion without eval.
 */
class CombinatoricsSynthesizer
{
    private PeanoSuccessorLogic $peano;

    public function __construct()
    {
        $this->peano = new PeanoSuccessorLogic();
    }

    /**
     * Calculates factorial n!
     */
    public function factorial(int $n): int
    {
        if ($n <= 1) {
            return 1;
        }
        $result = 1;
        for ($i = 2; $i <= $n; $i = $this->peano->successor($i)) {
            $result = $this->peano->multiply($result, $i);
        }
        return $result;
    }

    /**
     * Calculates combinations nCr = n! / (k!(n-k)!)
     */
    public function combination(int $n, int $k): int
    {
        if ($k === 0 || $k === $n) {
            return 1;
        }
        
        $numerator = $this->factorial($n);
        $denominator = $this->peano->multiply($this->factorial($k), $this->factorial($this->peano->add($n, $this->peano->negate($k))));
        
        return $this->peanoDivide($numerator, $denominator);
    }

    /**
     * Performs exact division of integers using Peano Subtraction to replace `/` operator.
     */
    public function peanoDivide(int $a, int $b): int
    {
        if ($b === 0) {
            throw new \InvalidArgumentException("Division by zero in CAS");
        }
        
        $quotient = 0;
        $remainder = $a;
        
        // Division algorithm purely using Peano Operations
        while ($remainder >= $b) {
            $remainder = $this->peano->add($remainder, $this->peano->negate($b));
            $quotient = $this->peano->successor($quotient);
        }
        
        return $quotient;
    }
}
