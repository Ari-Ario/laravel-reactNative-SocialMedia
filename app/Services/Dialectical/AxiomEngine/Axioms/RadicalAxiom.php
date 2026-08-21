<?php

namespace App\Services\Dialectical\AxiomEngine\Axioms;

/**
 * Radical Axiom
 * Represents the axioms around roots, radicals, fractional exponents, and field extensions.
 */
class RadicalAxiom extends BaseAxiom
{
    public function __construct()
    {
        $this->axiomId = 'radical_exponentiation';
        $this->formalName = 'Axioms of Radicals and Fractional Exponents';
        $this->systemFamily = 'Algebra / Real Analysis';
        $this->parentDependencies = ['field_axioms'];
        $this->symbolicRepresentation = 'x^(m/n) = nth_root(x^m)';
    }

    public function isApplicable(array $astContext): bool
    {
        $expression = $astContext['expression'] ?? '';
        if (str_contains($expression, '√') || str_contains($expression, 'root') || preg_match('/\^\([\d\w]+\/[\d\w]+\)/', $expression)) {
            return true;
        }

        return false;
    }

    public function applyAxiom(array $astContext): array
    {
        return array_merge(parent::applyAxiom($astContext), [
            'radical_transformation' => 'Convert roots into fractional exponents to apply exponentiation laws.',
            'even_root_constraint' => 'If n is even in nth_root(x), then x ≥ 0 over ℝ.',
            'irrationality_check' => 'Roots of non-perfect powers are irrational over ℚ.'
        ]);
    }
}
