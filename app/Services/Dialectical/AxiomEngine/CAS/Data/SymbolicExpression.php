<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Data;

/**
 * Represents a sum of SymbolicTerms, e.g., 4x^2 + 12x + 9
 */
class SymbolicExpression
{
    /**
     * @var SymbolicTerm[]
     */
    public array $terms;

    public function __construct(array $terms = [])
    {
        $this->terms = $terms;
    }

    public function addTerm(SymbolicTerm $term): void
    {
        $this->terms[] = $term;
    }

    public function __toString(): string
    {
        if (empty($this->terms)) {
            return "0";
        }

        $str = "";
        foreach ($this->terms as $i => $term) {
            $termStr = (string)$term;
            if ($termStr === "0") {
                continue;
            }

            if ($i > 0 && $term->coefficient > 0) {
                $str .= " + " . $termStr;
            } elseif ($i > 0 && $term->coefficient < 0) {
                // $termStr already includes the negative sign if coefficient is negative
                // Wait, if $termStr is "-3x", we want " - 3x" or "+ -3x". Let's do " - 3x".
                $str .= " - " . substr($termStr, 1);
            } else {
                $str .= $termStr;
            }
        }

        return $str === "" ? "0" : $str;
    }
}
