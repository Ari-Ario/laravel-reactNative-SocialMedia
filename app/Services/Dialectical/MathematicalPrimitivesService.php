<?php

namespace App\Services\Dialectical;

/**
 * ============================================================================
 * MathematicalPrimitivesService — Zmzir Dialectical Engine
 * ============================================================================
 * 
 * Provides the fundamental native mathematical concepts required for pure,
 * dynamic induction (Phase 1 & 3). Handles Parity, Primes, Factorization,
 * and deterministic sequence generation ("less-to-more").
 * ============================================================================
 */
class MathematicalPrimitivesService
{
    /**
     * Is the given integer even?
     */
    public function isEven(int $n): bool
    {
        return $n % 2 === 0;
    }

    /**
     * Is the given integer odd?
     */
    public function isOdd(int $n): bool
    {
        return $n % 2 !== 0;
    }

    /**
     * Checks if a number is prime using deterministic logic.
     */
    public function isPrime(int $n): bool
    {
        if ($n <= 1) return false;
        if ($n <= 3) return true;
        if ($n % 2 === 0 || $n % 3 === 0) return false;
        
        for ($i = 5; $i * $i <= $n; $i += 6) {
            if ($n % $i === 0 || $n % ($i + 2) === 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Correctly classifies an integer's primality status:
     * - <= 1: "Unit" (neither prime nor composite)
     * - prime: "Prime"
     * - composite: "Composite"
     */
    public function classifyPrimality(int $n): string
    {
        if ($n <= 1) {
            return 'Unit';
        }
        return $this->isPrime($n) ? 'Prime' : 'Composite';
    }

    /**
     * Generates a deterministic array of integers from $start to $limit
     * Used for the "less-to-more" empirical induction sequences.
     */
    public function generateSequence(int $start, int $limit): array
    {
        $sequence = [];
        for ($i = $start; $i <= $limit; $i++) {
            $sequence[] = $i;
        }
        return $sequence;
    }

    /**
     * Generates an array of the first N numbers starting from $startFrom
     */
    public function generateFirstN(int $count, int $startFrom = 1): array
    {
        $sequence = [];
        for ($i = 0; $i < $count; $i++) {
            $sequence[] = $startFrom + $i;
        }
        return $sequence;
    }

    /**
     * Generates an array of the first N even numbers starting from $startFrom (which should be even)
     */
    public function generateEvenNumbers(int $count, int $startFrom = 2): array
    {
        if ($this->isOdd($startFrom)) {
            $startFrom++;
        }
        $sequence = [];
        for ($i = 0; $i < $count; $i++) {
            $sequence[] = $startFrom + ($i * 2);
        }
        return $sequence;
    }

    /**
     * Generates an array of the first N odd numbers starting from $startFrom (which should be odd)
     */
    public function generateOddNumbers(int $count, int $startFrom = 1): array
    {
        if ($this->isEven($startFrom)) {
            $startFrom++;
        }
        $sequence = [];
        for ($i = 0; $i < $count; $i++) {
            $sequence[] = $startFrom + ($i * 2);
        }
        return $sequence;
    }

    /**
     * Generates an array of the N primes, optionally starting from a random or specific offset to ensure dynamic selection.
     */
    public function generateNthPrimes(int $count, int $startOffset = 2): array
    {
        $primes = [];
        $i = max(2, $startOffset);
        while (count($primes) < $count) {
            if ($this->isPrime($i)) {
                $primes[] = $i;
            }
            $i++;
        }
        return $primes;
    }

    /**
     * Generates an array of primes that specifically belong to twin prime pairs (p, p+2).
     */
    public function generateTwinPrimes(int $count, int $startOffset = 3): array
    {
        $primes = [];
        $i = max(3, $startOffset);
        if ($this->isEven($i)) $i++; // Ensure it's odd
        
        while (count($primes) < $count) {
            if ($this->isPrime($i) && ($this->isPrime($i + 2) || $this->isPrime($i - 2))) {
                $primes[] = $i;
            }
            $i += 2;
        }
        return $primes;
    }

    /**
     * Generates an array of primes up to a specific limit
     */
    public function generatePrimesUpTo(int $max): array
    {
        $primes = [];
        for ($i = 2; $i <= $max; $i++) {
            if ($this->isPrime($i)) {
                $primes[] = $i;
            }
        }
        return $primes;
    }

    /**
     * Returns the prime factorization of a given number.
     */
    public function getPrimeFactors(int $n): array
    {
        $factors = [];
        // Factor out 2
        while ($n % 2 === 0) {
            $factors[] = 2;
            $n /= 2;
        }
        // Factor out odd numbers
        for ($i = 3; $i * $i <= $n; $i += 2) {
            while ($n % $i === 0) {
                $factors[] = $i;
                $n /= $i;
            }
        }
        // If n is a prime greater than 2
        if ($n > 2) {
            $factors[] = $n;
        }
        return $factors;
    }

    /**
     * Collatz next step logic
     */
    public function collatzStep(int $n): int
    {
        return $this->isEven($n) ? (int)($n / 2) : 3 * $n + 1;
    }

    /**
     * Generates standard trigonometric angle sample points (0, pi/6, pi/4, pi/3, pi/2).
     */
    public function generateTrigAngles(int $count = 5): array
    {
        $angles = [
            ['label' => '0', 'value' => 0.0],
            ['label' => 'π/6', 'value' => M_PI / 6.0],
            ['label' => 'π/4', 'value' => M_PI / 4.0],
            ['label' => 'π/3', 'value' => M_PI / 3.0],
            ['label' => 'π/2', 'value' => M_PI / 2.0],
            ['label' => 'π', 'value' => M_PI],
            ['label' => '2π', 'value' => 2.0 * M_PI],
        ];
        return array_slice($angles, 0, min($count, count($angles)));
    }

    /**
     * Generates standard logarithmic/exponential sample inputs (1, 2, 3, e, e^2).
     */
    public function generateLogInputs(int $count = 5): array
    {
        $inputs = [
            ['label' => '1', 'value' => 1.0],
            ['label' => '2', 'value' => 2.0],
            ['label' => '3', 'value' => 3.0],
            ['label' => 'e', 'value' => M_E],
            ['label' => 'e²', 'value' => M_E * M_E],
        ];
        return array_slice($inputs, 0, min($count, count($inputs)));
    }

    /**
     * Natively evaluates trigonometric functions.
     */
    public function evaluateTrigFunc(string $func, float $x): float
    {
        return match (strtolower(trim($func))) {
            'sin'  => sin($x),
            'cos'  => cos($x),
            'tan'  => tan($x),
            'sinh' => sinh($x),
            'cosh' => cosh($x),
            'tanh' => tanh($x),
            'asin' => asin($x),
            'acos' => acos($x),
            'atan' => atan($x),
            default => 0.0
        };
    }

    /**
     * Natively evaluates logarithmic/exponential functions.
     */
    public function evaluateLogFunc(string $func, float $x): float
    {
        return match (strtolower(trim($func))) {
            'ln', 'log' => log($x),
            'log10'     => log10($x),
            'exp'       => exp($x),
            'sqrt'      => sqrt($x),
            default     => 0.0
        };
    }
}

