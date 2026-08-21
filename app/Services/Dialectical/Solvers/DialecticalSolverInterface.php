<?php

namespace App\Services\Dialectical\Solvers;

interface DialecticalSolverInterface
{
    /**
     * Phase 1: Empirical Trial
     * Formulates the concrete trial/test cases or substitution limits.
     */
    public function executePhase1Trial(string $thesis, ?array $astMatrix = null): array;

    /**
     * Phase 2: Deductive Purification
     * Resolves the thesis using fundamental roots (Axiom 1 & 2) and Socratic filters.
     */
    public function executePhase2Deduction(array $state): array;

    /**
     * Phase 3: Total Inductive System
     * Finalizes the proof and returns the full syntactically rendered text.
     */
    public function executePhase3Induction(array $state): string;
}
