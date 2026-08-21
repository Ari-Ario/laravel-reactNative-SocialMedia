<?php

namespace App\Services\Engines;

use App\Contracts\DialecticalDomainInterface;
use App\Services\DialecticalKeywordBank;

class PhysicsEngineService implements DialecticalDomainInterface
{
    public function canHandle(string $thesis): bool
    {
        foreach (DialecticalKeywordBank::get()['physics'] as $kw) {
            if (preg_match('/\b' . preg_quote($kw, '/') . '\b/i', $thesis)) return true;
        }
        return false;
    }

    public function convertToMathOrLogic(string $thesis): array
    {
        $lower = strtolower($thesis);

        if (str_contains($lower, 'speed of light') || str_contains($lower, 'relativity') || str_contains($lower, 'lorentz')) {
            return ['type' => 'math', 'expression' => 'prove: Limit(v->c) 1 / sqrt(1 - (v^2)/(c^2)) = infinity'];
        }
        if (str_contains($lower, 'force') || str_contains($lower, 'newton') || str_contains($lower, 'acceleration')) {
            // Extract bindings from the original thesis if any
            preg_match_all('/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\d\.]+)/', $thesis, $matches, PREG_SET_ORDER);
            $vars = [];
            foreach ($matches as $m) {
                $vars[strtolower($m[1])] = $m[2];
            }
            $mass = $vars['mass'] ?? $vars['m'] ?? 'm';
            $accel = $vars['acceleration'] ?? $vars['a'] ?? 'a';
            return ['type' => 'math', 'expression' => "calculate: Force where mass={$mass}, acceleration={$accel}"];
        }
        if (str_contains($lower, 'entropy') || str_contains($lower, 'thermodynamics') || str_contains($lower, 'boltzmann')) {
            return ['type' => 'math', 'expression' => 'prove: dS >= 0 for isolated system (Second Law)'];
        }
        if (str_contains($lower, 'quantum') || str_contains($lower, 'heisenberg') || str_contains($lower, 'uncertainty')) {
            return ['type' => 'math', 'expression' => 'prove: delta_x * delta_p >= hbar/2'];
        }
        if (str_contains($lower, 'energy') || str_contains($lower, 'kinetic') || str_contains($lower, 'potential')) {
            return ['type' => 'math', 'expression' => 'prove: E = (1/2)*m*v^2 + m*g*h'];
        }
        if (str_contains($lower, 'wave') || str_contains($lower, 'frequency') || str_contains($lower, 'wavelength')) {
            return ['type' => 'math', 'expression' => 'prove: c = frequency * wavelength'];
        }
        return ['type' => 'logic', 'expression' => 'PhysicalLaw -> MathematicalBound'];
    }

    public function generateSynthesis(string $thesis, bool $isProven): string
    {
        if ($isProven) {
            return "The physical law '{$thesis}' was deductively translated into a pure mathematical constraint and rigorously proven as an absolute physical boundary within the dialectical methodology.";
        }
        return "The physical boundary described in '{$thesis}' could not be mapped to a stable mathematical continuum. Sent to expert review.";
    }
}
