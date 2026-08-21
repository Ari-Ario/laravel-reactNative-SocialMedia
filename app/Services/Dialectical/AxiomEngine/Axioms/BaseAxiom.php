<?php

namespace App\Services\Dialectical\AxiomEngine\Axioms;

use App\Services\Dialectical\AxiomEngine\Contracts\DialecticalAxiomInterface;

/**
 * Abstract BaseAxiom
 * Provides a foundational implementation for mathematical axioms.
 */
abstract class BaseAxiom implements DialecticalAxiomInterface
{
    protected string $axiomId;
    protected string $formalName;
    protected string $systemFamily;
    protected array $parentDependencies = [];
    protected string $symbolicRepresentation = '';

    public function getAxiomId(): string
    {
        return $this->axiomId;
    }

    public function getFormalName(): string
    {
        return $this->formalName;
    }

    public function getSystemFamily(): string
    {
        return $this->systemFamily;
    }

    public function getParentDependencies(): array
    {
        return $this->parentDependencies;
    }

    public function getSymbolicRepresentation(): string
    {
        return $this->symbolicRepresentation;
    }

    /**
     * Default fallback application logic if the axiom doesn't override it.
     */
    public function applyAxiom(array $astContext): array
    {
        return [
            'axiom_id' => $this->getAxiomId(),
            'applied_name' => $this->getFormalName(),
            'symbolic_reference' => $this->getSymbolicRepresentation(),
            'status' => 'applied_base_structural_mapping',
            'abstract_variables' => $astContext['variables'] ?? [],
        ];
    }
}
