<?php

namespace App\Services\Dialectical\AxiomEngine\Empirical\Fragment9;

class ConstraintExtractor
{
    /**
     * Given a variable name and a domain constraint string (e.g., 'Z', 'N', 'B'),
     * generates a finite iterable array for empirical brute force testing.
     * 
     * Abstract domains are mapped to physical program limits.
     */
    public function extractDomainIterable(string $domainType, int $limit = 1000): array
    {
        switch (strtoupper($domainType)) {
            case 'B':
            case 'BOOLEAN':
                return [false, true];
                
            case 'N':
            case 'NATURAL':
                // Natural numbers: 1 to $limit
                return range(1, $limit);
                
            case 'W':
            case 'WHOLE':
                // Whole numbers: 0 to $limit
                return range(0, $limit);

            case 'Z':
            case 'INTEGER':
                // Integers: -$limit to $limit
                return range(-$limit, $limit);

            case 'P':
            case 'PRIME':
                // Returns an array of prime numbers up to $limit
                return $this->generatePrimes($limit);
                
            case 'R':
            case 'REAL':
                // Real numbers are uncountably infinite. For empirical testing,
                // we synthesize a floating point discrete set between -limit and limit
                // with fractional steps.
                return $this->generateReals(-$limit, $limit, 100);

            default:
                throw new \InvalidArgumentException("Unsupported empirical domain: $domainType");
        }
    }

    /**
     * Sieve of Eratosthenes to generate prime boundaries up to $limit.
     */
    private function generatePrimes(int $limit): array
    {
        if ($limit < 2) return [];
        $is_prime = array_fill(0, $limit + 1, true);
        $is_prime[0] = false;
        $is_prime[1] = false;
        
        for ($p = 2; $p * $p <= $limit; $p++) {
            if ($is_prime[$p] == true) {
                for ($i = $p * $p; $i <= $limit; $i += $p) {
                    $is_prime[$i] = false;
                }
            }
        }
        
        $primes = [];
        for ($p = 2; $p <= $limit; $p++) {
            if ($is_prime[$p]) {
                $primes[] = $p;
            }
        }
        return $primes;
    }
    
    /**
     * Generates a discrete set of floating point numbers across a range.
     */
    private function generateReals(int $min, int $max, int $steps): array
    {
        $reals = [];
        $stepSize = ($max - $min) / $steps;
        for ($i = 0; $i <= $steps; $i++) {
            $reals[] = $min + ($i * $stepSize);
        }
        return $reals;
    }
}
