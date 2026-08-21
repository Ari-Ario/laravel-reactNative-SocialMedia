<?php

namespace App\Services\Engines;

use App\Contracts\DialecticalDomainInterface;
use App\Services\DialecticalKeywordBank;

class CivilEngineeringEngineService implements DialecticalDomainInterface
{
    public function canHandle(string $thesis): bool
    {
        foreach (DialecticalKeywordBank::get()['engineering'] as $kw) {
            if (preg_match('/\b' . preg_quote($kw, '/') . '\b/i', $thesis)) return true;
        }
        return false;
    }

    public function convertToMathOrLogic(string $thesis): array
    {
        $lower = strtolower($thesis);

        if (str_contains($lower, 'hooke') || str_contains($lower, 'stress') || str_contains($lower, 'strain')) {
            return ['type' => 'math', 'expression' => 'prove: σ = E * ε (Hooke law, stress-strain proportionality)'];
        }
        if (str_contains($lower, 'euler buckling') || str_contains($lower, 'critical load') || str_contains($lower, 'column')) {
            return ['type' => 'math', 'expression' => 'prove: P_cr = π^2 * E * I / (L^2) (Euler buckling load)'];
        }
        if (str_contains($lower, 'bernoulli euler') || str_contains($lower, 'bending') || str_contains($lower, 'beam')) {
            return ['type' => 'math', 'expression' => 'prove: M/I = σ/y = E/R (Euler-Bernoulli beam equation)'];
        }
        if (str_contains($lower, 'kirchhoff') || str_contains($lower, 'circuit') || str_contains($lower, 'voltage') || str_contains($lower, 'current')) {
            return ['type' => 'math', 'expression' => 'prove: Sum(V) = 0 (KVL) and Sum(I) = 0 (KCL) at every node'];
        }
        if (str_contains($lower, 'thevenin') || str_contains($lower, 'norton') || str_contains($lower, 'equivalent')) {
            return ['type' => 'math', 'expression' => 'prove: Any linear circuit = V_th + R_th (Thevenin equivalence)'];
        }
        if (str_contains($lower, 'bernoulli equation') || str_contains($lower, 'fluid') || str_contains($lower, 'pressure flow')) {
            return ['type' => 'math', 'expression' => 'prove: P + (1/2)*ρ*v^2 + ρ*g*h = constant (Bernoulli)'];
        }
        if (str_contains($lower, 'fourier') || str_contains($lower, 'heat transfer') || str_contains($lower, 'conduction')) {
            return ['type' => 'math', 'expression' => 'prove: q = -k * A * (dT/dx) (Fourier law of heat conduction)'];
        }
        if (str_contains($lower, 'resonance') || str_contains($lower, 'natural frequency') || str_contains($lower, 'oscillation')) {
            return ['type' => 'math', 'expression' => 'prove: f_n = (1/2π) * sqrt(k/m) (natural frequency)'];
        }
        return ['type' => 'math', 'expression' => 'StructuralLoad -> StressDistribution -> DeformationLimit'];
    }

    public function generateSynthesis(string $thesis, bool $isProven): string
    {
        if ($isProven) {
            return "The engineering principle '{$thesis}' was mathematically verified through material science and structural/circuit axioms. The design constraint holds within established physical limits.";
        }
        return "The engineering system described in '{$thesis}' requires empirical material testing. Sent for structural engineering review.";
    }
}
