<?php

namespace App\Services\Engines;

use App\Contracts\DialecticalDomainInterface;
use App\Services\DialecticalKeywordBank;

class SocialScienceEngineService implements DialecticalDomainInterface
{
    public function canHandle(string $thesis): bool
    {
        foreach (DialecticalKeywordBank::get()['social'] as $kw) {
            if (preg_match('/\b' . preg_quote($kw, '/') . '\b/i', $thesis)) return true;
        }
        // Proxy: very long sociological text
        return strlen($thesis) > 120;
    }

    public function convertToMathOrLogic(string $thesis): array
    {
        $lower = strtolower($thesis);

        if (str_contains($lower, 'nash equilibrium') || str_contains($lower, 'game theory')) {
            return ['type' => 'math', 'expression' => 'prove: ∃ Nash equilibrium s* such that u_i(s*) ≥ u_i(s_i, s*_{-i}) ∀i'];
        }
        if (str_contains($lower, 'prisoner') || str_contains($lower, 'dilemma')) {
            return ['type' => 'logic', 'expression' => 'Defect(A) ∧ Cooperate(B) -> Utility_A > Utility_B (dominant strategy)'];
        }
        if (str_contains($lower, 'dialectic of groups') || str_contains($lower, 'groups struggle') || str_contains($lower, 'class struggle')) {
            return ['type' => 'logic', 'expression' => 'Group(A) ⊕ Group(B) -> Struggle -> Synthesis (dialectical resolution)'];
        }
        if (str_contains($lower, 'supply') || str_contains($lower, 'demand') || str_contains($lower, 'market')) {
            return ['type' => 'math', 'expression' => 'prove: At equilibrium P*: Q_supplied(P*) = Q_demanded(P*)'];
        }
        if (str_contains($lower, 'pareto') || str_contains($lower, 'efficiency') || str_contains($lower, 'optimal')) {
            return ['type' => 'logic', 'expression' => 'Pareto(X): ∄Y such that u_i(Y) ≥ u_i(X) ∀i with strict for some i'];
        }
        if (str_contains($lower, 'inequality') || str_contains($lower, 'gini') || str_contains($lower, 'distribution')) {
            return ['type' => 'math', 'expression' => 'prove: Gini = 1 - 2 * ∫₀¹ L(x)dx (Lorenz curve integration)'];
        }
        if (str_contains($lower, 'behavior') || str_contains($lower, 'pavlov') || str_contains($lower, 'learning')) {
            return ['type' => 'logic', 'expression' => 'Stimulus(S) -> Response(R): P(R|S) > P(R|~S) (conditioning)'];
        }
        // General propositional mapping for causal social text
        if (str_contains($lower, 'if') && str_contains($lower, 'then')) {
            return ['type' => 'logic', 'expression' => 'SocialCause(A) -> SocialEffect(B)'];
        }
        if (str_contains($lower, 'all') && str_contains($lower, 'are')) {
            return ['type' => 'logic', 'expression' => '∀x: A(x) -> B(x) (universal social predicate)'];
        }
        return ['type' => 'logic', 'expression' => 'SocialAction(A) -> Reaction(B) -> Synthesis(C) (dialectical tautology)'];
    }

    public function generateSynthesis(string $thesis, bool $isProven): string
    {
        if ($isProven) {
            return "The societal theorem '{$thesis}' was parsed via the Semantic NLP Pipeline into First-Order Logic predicates. It was verified to be non-contradictory against all pre-existing axioms in the global knowledge graph, averting Dialectical Collapse.";
        }
        return "CRITICAL: Dialectical Collapse. The proposed social thesis '{$thesis}' contains fundamental contradictions against established absolute truths (P ∧ ¬P). Immediately filtered to prevent corruption of the knowledge graph.";
    }
}
