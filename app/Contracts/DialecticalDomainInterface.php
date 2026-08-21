<?php

namespace App\Contracts;

interface DialecticalDomainInterface
{
    /**
     * Determine if this engine can translate the given thesis.
     */
    public function canHandle(string $thesis): bool;

    /**
     * Translate the domain-specific thesis into a pure Math AST or Formal Logic proposition.
     * Returns an array: ['type' => 'math'|'logic', 'expression' => string]
     */
    public function convertToMathOrLogic(string $thesis): array;

    /**
     * Generate a human-readable synthesis of how the domain concept maps to the proven mathematics.
     */
    public function generateSynthesis(string $thesis, bool $isProven): string;
}
