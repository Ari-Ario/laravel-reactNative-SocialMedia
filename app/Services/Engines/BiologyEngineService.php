<?php

namespace App\Services\Engines;

use App\Contracts\DialecticalDomainInterface;
use App\Services\DialecticalKeywordBank;

class BiologyEngineService implements DialecticalDomainInterface
{
    public function canHandle(string $thesis): bool
    {
        foreach (DialecticalKeywordBank::get()['biology'] as $kw) {
            if (preg_match('/\b' . preg_quote($kw, '/') . '\b/i', $thesis)) return true;
        }
        return false;
    }

    public function convertToMathOrLogic(string $thesis): array
    {
        $lower = strtolower($thesis);

        if (str_contains($lower, 'hardy weinberg') || str_contains($lower, 'hardy-weinberg')) {
            return ['type' => 'math', 'expression' => 'prove: (p+q)^2 = p^2 + 2pq + q^2 = 1 (Hardy-Weinberg equilibrium)'];
        }
        if (str_contains($lower, 'natural selection') || str_contains($lower, 'evolution') || str_contains($lower, 'darwin')) {
            return ['type' => 'logic', 'expression' => 'Variation(Trait) ∧ Heritability(Trait) ∧ DifferentialReproduction -> Evolution'];
        }
        if (str_contains($lower, 'photosynthesis')) {
            return ['type' => 'math', 'expression' => 'prove: 6CO2 + 6H2O + light_energy -> C6H12O6 + 6O2 (balanced)'];
        }
        if (str_contains($lower, 'osmosis') || str_contains($lower, 'diffusion') || str_contains($lower, 'membrane')) {
            return ['type' => 'math', 'expression' => 'prove: J = -D * (dc/dx) (Fick law of diffusion)'];
        }
        if (str_contains($lower, 'population') || str_contains($lower, 'logistic') || str_contains($lower, 'growth')) {
            return ['type' => 'math', 'expression' => 'prove: dN/dt = rN(1 - N/K) (logistic growth)'];
        }
        if (str_contains($lower, 'dna') || str_contains($lower, 'replication') || str_contains($lower, 'transcription')) {
            return ['type' => 'logic', 'expression' => 'DNA -> (transcription) -> mRNA -> (translation) -> Protein'];
        }
        if (str_contains($lower, 'mendelian') || str_contains($lower, 'genetics') || str_contains($lower, 'allele')) {
            return ['type' => 'math', 'expression' => 'prove: P(AA) + P(Aa) + P(aa) = 1 (Mendelian segregation)'];
        }
        return ['type' => 'logic', 'expression' => 'BiologicalProcess -> ChemicalReaction -> PhysicalConstraint'];
    }

    public function generateSynthesis(string $thesis, bool $isProven): string
    {
        if ($isProven) {
            return "The biological principle '{$thesis}' was translated into its mathematical and logical foundations and verified against established biochemical and evolutionary axioms.";
        }
        return "The biological phenomenon '{$thesis}' requires further empirical data. Sent for expert biological review.";
    }
}
