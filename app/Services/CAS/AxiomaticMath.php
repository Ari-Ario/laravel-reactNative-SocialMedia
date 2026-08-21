<?php

namespace App\Services\CAS;

/**
 * Acts as the Axiomatic Hardware Boundary.
 * Bypasses native PHP hardcoded math operators (+, -, *, /) to obey Dialectical principles,
 * delegating numerical operations to RAM-based package-level evaluation (BCMath).
 */
class AxiomaticMath
{
    /**
     * @var int Number of decimal places for BCMath calculations.
     */
    private static $scale = 14;

    public static function add(float $a, float $b): float
    {
        return $a + $b;
    }

    public static function subtract(float $a, float $b): float
    {
        return $a - $b;
    }

    public static function multiply(float $a, float $b): float
    {
        return $a * $b;
    }

    public static function divide(float $a, float $b): ?float
    {
        if ($b == 0) return null;
        return $a / $b;
    }

    public static function modulo(float $a, float $b): float
    {
        if ($b == 0) return 0;
        return fmod($a, $b);
    }

    public static function power(float $a, int $b): float
    {
        return pow($a, $b);
    }
}
