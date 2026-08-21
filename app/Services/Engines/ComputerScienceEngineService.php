<?php

namespace App\Services\Engines;

use App\Contracts\DialecticalDomainInterface;
use App\Services\DialecticalKeywordBank;

class ComputerScienceEngineService implements DialecticalDomainInterface
{
    public function canHandle(string $thesis): bool
    {
        foreach (DialecticalKeywordBank::get()['computer_science'] as $kw) {
            if (preg_match('/\b' . preg_quote($kw, '/') . '\b/i', $thesis)) return true;
        }
        return false;
    }

    public function convertToMathOrLogic(string $thesis): array
    {
        $lower = strtolower($thesis);

        if (str_contains($lower, 'p vs np') || str_contains($lower, 'p=np') || str_contains($lower, 'p!=np')) {
            return ['type' => 'logic', 'expression' => 'Unsolved(P_vs_NP): P ⊆ NP, prove P = NP or P ≠ NP'];
        }
        if (str_contains($lower, 'halting') || str_contains($lower, 'turing') || str_contains($lower, 'decidable')) {
            return ['type' => 'logic', 'expression' => 'prove: ∄ algorithm A: A(P,I) decides halt(P,I) ∀P,I (Rice Theorem)'];
        }
        if (str_contains($lower, 'big-o') || str_contains($lower, 'complexity') || str_contains($lower, 'time complexity')) {
            return ['type' => 'math', 'expression' => 'prove: O(f(n)) bounds T(n) such that ∃c,n0: T(n) ≤ c*f(n) ∀n≥n0'];
        }
        if (str_contains($lower, 'algorithm') || str_contains($lower, 'sort') || str_contains($lower, 'search')) {
            return ['type' => 'math', 'expression' => 'prove: comparison-based sort Ω(n log n) lower bound'];
        }
        if (str_contains($lower, 'cryptography') || str_contains($lower, 'rsa') || str_contains($lower, 'encryption')) {
            return ['type' => 'math', 'expression' => 'prove: RSA security reduces to integer factorization hardness'];
        }
        if (str_contains($lower, 'shannon') || str_contains($lower, 'entropy') || str_contains($lower, 'information')) {
            return ['type' => 'math', 'expression' => 'prove: H(X) = -Sum(p(x) * log2(p(x))) (Shannon entropy)'];
        }
        if (str_contains($lower, 'graph') || str_contains($lower, 'tree') || str_contains($lower, 'path')) {
            return ['type' => 'math', 'expression' => 'prove: |E| >= |V| - 1 for connected tree (spanning property)'];
        }
        return ['type' => 'logic', 'expression' => 'Input -> Algorithm -> Output (computational correctness)'];
    }

    public function generateSynthesis(string $thesis, bool $isProven): string
    {
        if ($isProven) {
            return "The computational theorem '{$thesis}' was verified through formal logic and mathematical complexity analysis. The algorithm's correctness and complexity bounds have been established.";
        }
        return "The computational problem '{$thesis}' could not be resolved with current axioms. It may be an open problem or require additional constraints.";
    }
}
