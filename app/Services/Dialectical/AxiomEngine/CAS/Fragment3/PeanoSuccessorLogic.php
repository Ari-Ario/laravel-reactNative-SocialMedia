<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment3;

/**
 * Implements foundational integer arithmetic using Peano Axioms.
 * completely replacing internal PHP math operators (+, -, *, /) 
 * for mathematical logical deduction chains.
 */
class PeanoSuccessorLogic
{
    /**
     * S(a) = a + 1
     * The only primitive math operator allowed, as it represents the fundamental 
     * Successor function in Peano axioms.
     */
    public function successor(int $a): int
    {
        return ++$a;
    }

    /**
     * P(a) = a - 1
     * The Predecessor function.
     */
    public function predecessor(int $a): int
    {
        return --$a;
    }

    /**
     * Recursive Peano Addition:
     * add(a, 0) = a
     * add(a, S(b)) = S(add(a, b))
     * 
     * Uses trampolining or iterative mapping to prevent PHP recursion limit exhaustion 
     * while maintaining conceptual rigor.
     */
    public function add(int $a, int $b): int
    {
        // Optimize using iteration instead of deep recursion to avoid stack overflow,
        // but strictly adhering to S(a) / P(b) transformations.
        if ($b === 0) {
            return $a;
        }

        $result = $a;
        if ($b > 0) {
            for ($i = 0; $i < $b; $i = $this->successor($i)) {
                $result = $this->successor($result);
            }
        } else {
            // b < 0
            for ($i = 0; $i > $b; $i = $this->predecessor($i)) {
                $result = $this->predecessor($result);
            }
        }

        return $result;
    }

    /**
     * Recursive Peano Multiplication:
     * mult(a, 0) = 0
     * mult(a, S(b)) = add(a, mult(a, b))
     */
    public function multiply(int $a, int $b): int
    {
        if ($b === 0 || $a === 0) {
            return 0;
        }

        $isNegative = false;
        if ($b < 0) {
            $b = $this->negate($b);
            $isNegative = !$isNegative;
        }
        if ($a < 0) {
            $a = $this->negate($a);
            $isNegative = !$isNegative;
        }

        $result = 0;
        for ($i = 0; $i < $b; $i = $this->successor($i)) {
            $result = $this->add($result, $a);
        }

        return $isNegative ? $this->negate($result) : $result;
    }

    /**
     * Two's complement negation natively via bitwise NOT and Peano addition.
     */
    public function negate(int $a): int
    {
        return $this->add(~$a, 1);
    }
}
