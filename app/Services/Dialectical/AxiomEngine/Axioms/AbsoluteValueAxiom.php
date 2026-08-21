<?php

namespace App\Services\Dialectical\AxiomEngine\Axioms;

/**
 * Absolute Value Axiom
 * Represents the piecewise property and distance metric of absolute values |x|.
 */
class AbsoluteValueAxiom extends BaseAxiom
{
    public function __construct()
    {
        $this->axiomId = 'absolute_value_metric';
        $this->formalName = 'Axioms of Absolute Value and Metric Spaces';
        $this->systemFamily = 'Real Analysis';
        $this->parentDependencies = ['dedekind_completeness'];
        $this->symbolicRepresentation = '|x| = { x if x ≥ 0, -x if x < 0 }';
    }

    public function isApplicable(array $astContext): bool
    {
        // Check if the AST contains absolute value tokens, variables wrapped in | |, or keywords
        $expression = $astContext['expression'] ?? '';
        if (str_contains($expression, '|') || stripos($expression, 'absolute') !== false) {
            return true;
        }

        return false;
    }

    public function applyAxiom(array $astContext): array
    {
        $variables = $astContext['variables'] ?? ['x'];
        $var = $variables[0] ?? 'x';

        return array_merge(parent::applyAxiom($astContext), [
            'piecewise_split' => [
                'positive_case' => "Assume {$var} ≥ 0. Then |{$var}| = {$var}.",
                'negative_case' => "Assume {$var} < 0. Then |{$var}| = -{$var}."
            ],
            'triangle_inequality' => "|x + y| ≤ |x| + |y|",
            'domain_restriction' => "{$var} ∈ ℝ"
        ]);
    }
}
