<?php

namespace App\Services\Dialectical\Solvers;

/**
 * ============================================================================
 * DynamicInductionInterface
 * ============================================================================
 * 
 * Enforces the "less-to-more" paradigm across all Zmzir Dialectical solvers.
 * Replaces static/fake logic with deterministic mathematical loops.
 * ============================================================================
 */
interface DynamicInductionInterface
{
    /**
     * Phase 1: Empirical Observation (Trial & Error)
     * Must iterate through a deterministic sequence (e.g. n=1, 2, 3...)
     * and return a valid Markdown table of results.
     * 
     * @param array $ast The abstract syntax tree of the thesis
     * @param int $startSequence The starting 'n' value
     * @param int $limit The number of sequential iterations
     * @return string Markdown output for Phase 1
     */
    public function generateEmpiricalBaseCases(array $ast, int $startSequence = 1, int $limit = 5): string;

    /**
     * Phase 3: Inductive Synthesis
     * Uses the Phase 1 base cases to perform structural n -> n+1 induction.
     * 
     * @param array $ast The abstract syntax tree
     * @param string $domainPartition The domain metadata partition
     * @return string Markdown output for Phase 3
     */
    public function proveInductiveScaling(array $ast, string $domainPartition = ''): string;
}
