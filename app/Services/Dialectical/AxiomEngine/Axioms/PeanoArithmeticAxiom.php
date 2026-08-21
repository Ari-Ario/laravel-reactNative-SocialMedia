<?php

namespace App\Services\Dialectical\AxiomEngine\Axioms;

/**
 * Peano Arithmetic Axiom
 * Represents the fundamental axiomatic system for natural numbers, induction, and parity.
 */
class PeanoArithmeticAxiom extends BaseAxiom
{
    public function __construct()
    {
        $this->axiomId = 'peano_arithmetic';
        $this->formalName = 'Peano Axioms of Arithmetic';
        $this->systemFamily = 'Number Theory';
        $this->parentDependencies = ['first_order_logic'];
        $this->symbolicRepresentation = '∀P. (P(0) ∧ ∀n(P(n) → P(n+1))) → ∀n P(n)';
    }

    /**
     * Determines if Peano Axioms apply. Generally applies to integer sequences, parity, Collatz, etc.
     */
    public function isApplicable(array $astContext): bool
    {
        $domain = $astContext['domain'] ?? '';
        $constraints = $astContext['constraints'] ?? [];

        if ($domain === 'number_theory') {
            return true;
        }

        // Apply if variables are explicitly integers or natural numbers
        foreach ($constraints as $constraint) {
            if (in_array(strtolower($constraint), ['is even', 'is odd', 'integer', 'natural', 'prime', 'collatz'])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Overrides base application logic to inject specific Peano derivations.
     */
    public function applyAxiom(array $astContext): array
    {
        return array_merge(parent::applyAxiom($astContext), [
            'induction_base_case' => 'Let n = 1.',
            'induction_hypothesis' => 'Assume P(k) holds true for some k ∈ ℕ.',
            'induction_step' => 'We must prove P(k+1) is true.',
            'domain_restriction' => 'n ∈ ℕ'
        ]);
    }
}
