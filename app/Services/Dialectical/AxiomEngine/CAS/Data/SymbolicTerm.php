<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Data;

/**
 * Represents a single algebraic term, e.g., 3x^2y
 */
class SymbolicTerm
{
    public int $coefficient;
    
    /**
     * @var array<string, int> Associative array of variables to their exponents
     * e.g., ['x' => 2, 'y' => 1] for x^2 * y
     */
    public array $variables;

    public function __construct(int $coefficient, array $variables = [])
    {
        $this->coefficient = $coefficient;
        
        // Remove variables with exponent 0
        $this->variables = array_filter($variables, fn($exp) => $exp !== 0);
        ksort($this->variables); // Ensure consistent order for comparison
    }

    /**
     * Returns true if both terms have the same variables and exponents.
     */
    public function isLikeTerm(SymbolicTerm $other): bool
    {
        return $this->variables === $other->variables;
    }

    public function __toString(): string
    {
        if ($this->coefficient === 0) {
            return "0";
        }
        
        $varsStr = "";
        foreach ($this->variables as $var => $exp) {
            if ($exp === 1) {
                $varsStr .= $var;
            } else {
                $varsStr .= $var . '^' . $exp;
            }
        }

        if ($varsStr === "") {
            return (string)$this->coefficient;
        }

        if ($this->coefficient === 1) {
            return $varsStr;
        }
        
        if ($this->coefficient === -1) {
            return "-" . $varsStr;
        }

        return $this->coefficient . $varsStr;
    }
}
