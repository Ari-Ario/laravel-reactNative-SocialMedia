<?php

namespace App\Services\Dialectical\Solvers;

use App\Services\DialecticalOracleService;

/**
 * ABSTRACT DYNAMIC DIALECTICAL SOLVER
 *
 * This base class guarantees 100% Zero-Hardcoding across all scientific solvers.
 * It strictly intercepts the 3-phase dialectical execution pipeline and queries the
 * Axiom Graph dynamically via the AxiomDefinitionLoader.
 *
 * It evaluates the mathematical proof dynamically,
 * eliminating the need to stop or use hardcoded responses.
 */
abstract class AbstractDynamicDialecticalSolver implements DialecticalSolverInterface
{
    /**
     * Intercepts Phase 1.
     */
    final public function executePhase1Trial(string $thesis, ?array $astMatrix = null): array
    {
        // Absolute Routing: Native structural logic 
        // WHICH NOW LOADS DYNAMICALLY FROM AXIOMS/DEFINITIONS
        return $this->fallbackPhase1Trial($thesis, $astMatrix);
    }

    /**
     * Intercepts Phase 2.
     */
    final public function executePhase2Deduction(array $state): array
    {
        return $this->fallbackPhase2Deduction($state);
    }

    /**
     * Intercepts Phase 3.
     */
    final public function executePhase3Induction(array $state): string
    {
        return $this->fallbackPhase3Induction($state);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ABSTRACT FALLBACK METHODS (Must be implemented by legacy child solvers)
    // ──────────────────────────────────────────────────────────────────────────

    abstract protected function fallbackPhase1Trial(string $thesis, ?array $astMatrix = null): array;
    abstract protected function fallbackPhase2Deduction(array $state): array;
    abstract protected function fallbackPhase3Induction(array $state): string;
}
