<?php

namespace App\Services\Dialectical\AxiomEngine\Axioms;

/**
 * Zermelo-Fraenkel Set Theory Axiom (ZFC)
 * Represents foundational set theory axioms (Extensionality, Pairing, Union, Power Set, etc.)
 */
class ZermeloFraenkelAxiom extends BaseAxiom
{
    public function __construct()
    {
        $this->axiomId = 'zfc_set_theory';
        $this->formalName = 'Zermelo-Fraenkel Set Theory with Choice (ZFC)';
        $this->systemFamily = 'Set Theory';
        $this->parentDependencies = ['first_order_logic'];
        $this->symbolicRepresentation = '∀x∀y (∀z(z∈x ↔ z∈y) → x=y)'; // Axiom of Extensionality as a placeholder
    }

    public function isApplicable(array $astContext): bool
    {
        $domain = $astContext['domain'] ?? '';
        $expression = $astContext['expression'] ?? '';

        if ($domain === 'set_theory') {
            return true;
        }

        // Apply if set notation or keywords are found
        if (str_contains($expression, '∪') || str_contains($expression, '∩') || str_contains($expression, '∈') || str_contains($expression, 'subset')) {
            return true;
        }

        return false;
    }

    public function applyAxiom(array $astContext): array
    {
        return array_merge(parent::applyAxiom($astContext), [
            'set_operations' => [
                'union' => 'A ∪ B = {x | x ∈ A ∨ x ∈ B}',
                'intersection' => 'A ∩ B = {x | x ∈ A ∧ x ∈ B}',
                'subset' => 'A ⊆ B ↔ ∀x(x ∈ A → x ∈ B)'
            ],
            'axiom_of_extensionality' => 'Two sets are equal if and only if they have the same elements.'
        ]);
    }
}
