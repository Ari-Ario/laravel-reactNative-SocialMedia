<?php

namespace App\Services\Dialectical\AxiomEngine\CAS;

use App\Services\Dialectical\AxiomEngine\AxiomRegistry;
use App\Services\Dialectical\AxiomEngine\Contracts\DialecticalAxiomInterface;
use App\Services\Dialectical\AxiomEngine\CAS\Data\SymbolicExpression;

/**
 * Base Execution Harness for the Universal Symbolic Manipulator (CAS)
 */
abstract class AbstractSymbolicEngine
{
    protected AxiomRegistry $registry;

    public function __construct(AxiomRegistry $registry)
    {
        $this->registry = $registry;
    }

    /**
     * Ingest a mathematical AST array and reduce it symbolically.
     * Overridden by specific engines (Fragment 3-8).
     */
    abstract public function ingest(array $astNode): SymbolicExpression;

    /**
     * Entry point to reduce an AST symbolically based on axioms.
     * Legacy method, wraps ingest for array compatibility.
     * 
     * @param array $ast The abstract syntax tree mapping.
     * @return array Reduced or transformed AST.
     */
    public function reduce(array $ast): array
    {
        // Wrapper for backwards compatibility while migrating to SymbolicExpression
        $expr = $this->ingest($ast);
        return [
            'type' => 'SymbolicExpression',
            'value' => (string)$expr
        ];
    }

    /**
     * Fetch the axiomatic constraint from the Registry to validate steps.
     */
    protected function fetchAxiomaticConstraint(string $axiomSignature): ?DialecticalAxiomInterface
    {
        return $this->registry->getAxiom($axiomSignature);
    }

    /**
     * Helper to validate a proof chain recursively.
     */
    protected function validateProofChain(array $proofSteps): bool
    {
        foreach ($proofSteps as $signature) {
            if (!$this->fetchAxiomaticConstraint($signature)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Resolves the foundational axioms required for a given AST context.
     *
     * @param array $astContext
     * @return DialecticalAxiomInterface[]
     */
    protected function fetchApplicableAxioms(array $astContext): array
    {
        return $this->registry->findApplicableAxioms($astContext);
    }
    
    /**
     * Applies a specific axiom to the AST to generate a trace step.
     */
    protected function applyAxiomaticTransformation(DialecticalAxiomInterface $axiom, array $ast): array
    {
        return $axiom->applyAxiom($ast);
    }
}
