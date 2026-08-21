<?php

namespace App\Services\Engines;

use App\Contracts\DialecticalDomainInterface;
use App\Services\DialecticalKeywordBank;

class ChemistryEngineService implements DialecticalDomainInterface
{
    public function canHandle(string $thesis): bool
    {
        foreach (DialecticalKeywordBank::get()['chemistry'] as $kw) {
            if (preg_match('/\b' . preg_quote($kw, '/') . '\b/i', $thesis)) return true;
        }
        return false;
    }

    public function convertToMathOrLogic(string $thesis): array
    {
        $lower = strtolower($thesis);

        if (str_contains($lower, 'stoichiometry') || str_contains($lower, 'mole') || str_contains($lower, 'avogadro')) {
            return ['type' => 'math', 'expression' => 'prove: n = mass / molar_mass (stoichiometric conservation)'];
        }
        if (str_contains($lower, 'equilibrium') || str_contains($lower, 'le chatelier')) {
            return ['type' => 'math', 'expression' => 'prove: Keq = [products]^p / [reactants]^r'];
        }
        if (str_contains($lower, 'oxidation') || str_contains($lower, 'redox') || str_contains($lower, 'reduction')) {
            return ['type' => 'logic', 'expression' => 'Oxidation(A) -> Reduction(B) (electron transfer conservation)'];
        }
        if (str_contains($lower, 'ph') || str_contains($lower, 'acid') || str_contains($lower, 'base')) {
            return ['type' => 'math', 'expression' => 'prove: pH + pOH = 14 at 25°C'];
        }
        if (str_contains($lower, 'enthalpy') || str_contains($lower, 'hess') || str_contains($lower, 'thermochemistry')) {
            return ['type' => 'math', 'expression' => 'prove: delta_H(reaction) = Sum(H_products) - Sum(H_reactants) (Hess Law)'];
        }
        if (str_contains($lower, 'electrolysis') || str_contains($lower, 'faraday')) {
            return ['type' => 'math', 'expression' => 'prove: m = (M * I * t) / (n * F) (Faraday electrolysis law)'];
        }
        return ['type' => 'logic', 'expression' => 'ChemicalReactant -> ChemicalProduct (conservation of mass)'];
    }

    public function generateSynthesis(string $thesis, bool $isProven): string
    {
        if ($isProven) {
            return "The chemical principle '{$thesis}' was translated into a stoichiometric mathematical model and verified via the dialectical 3-step methodology. Conservation laws hold universally.";
        }
        return "The chemical reaction described in '{$thesis}' could not be balanced by the current stoichiometric engine. Sent to expert review.";
    }
}
