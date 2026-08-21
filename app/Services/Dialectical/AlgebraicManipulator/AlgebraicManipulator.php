<?php

namespace App\Services\Dialectical\AlgebraicManipulator;

/**
 * Algebraic String Manipulator
 *
 * Simulates a lightweight Computer Algebra System (CAS) in pure PHP without using eval().
 * Dynamically expands binomials, substitutes variables, and simplifies polynomials.
 */
class AlgebraicManipulator
{
    /**
     * Substitutes a variable with an algebraic expression.
     * e.g., substitute('x^2 + x', 'x', '2k+1')
     */
    public function substitute(string $expression, string $variable, string $replacement): string
    {
        // Replace exact variable matches with the replacement wrapped in parentheses
        // Uses word boundaries to avoid replacing 'x' inside 'exp'
        $pattern = '/\b' . preg_quote($variable, '/') . '\b/';
        $substituted = preg_replace($pattern, '(' . $replacement . ')', $expression);

        return $this->simplify($substituted);
    }

    /**
     * Top-level symbolic simplifier.
     */
    public function simplify(string $expression): string
    {
        $expression = $this->expandBinomials($expression);
        $expression = $this->distributeConstants($expression);
        $expression = $this->collectLikeTerms($expression);

        return trim($expression);
    }

    /**
     * Expands simple binomials up to power 2 for induction logic.
     * e.g., (x+1)^2 => x^2 + 2x + 1
     */
    protected function expandBinomials(string $expression): string
    {
        // Expand (a + b)^2
        $expression = preg_replace_callback('/\(([a-zA-Z0-9]+)\s*\+\s*([a-zA-Z0-9]+)\)\^2/', function ($matches) {
            $a = $matches[1];
            $b = $matches[2];

            // if both are numbers
            if (is_numeric($a) && is_numeric($b)) {
                return (string) \App\Services\CAS\AxiomaticMath::power(\App\Services\CAS\AxiomaticMath::add((float)$a, (float)$b), 2);
            }

            // Parse '2k' into coeff and var
            $parseTerm = function($term) {
                if (preg_match('/^(\d+)([a-zA-Z]+)$/', $term, $m)) {
                    return [(float)$m[1], $m[2]];
                }
                if (is_numeric($term)) return [(float)$term, ''];
                return [1.0, $term];
            };

            list($aCoeff, $aVar) = $parseTerm($a);
            list($bCoeff, $bVar) = $parseTerm($b);

            $terms = [];

            // a^2
            $a2Coeff = \App\Services\CAS\AxiomaticMath::power($aCoeff, 2);
            if ($a2Coeff != 0) {
                $terms[] = ($a2Coeff == 1 && $aVar ? '' : $a2Coeff) . ($aVar ? "{$aVar}^2" : "");
            }

            // 2ab
            $abCoeff = \App\Services\CAS\AxiomaticMath::multiply(2.0, \App\Services\CAS\AxiomaticMath::multiply($aCoeff, $bCoeff));
            if ($abCoeff != 0) {
                $terms[] = ($abCoeff == 1 && ($aVar || $bVar) ? '' : $abCoeff) . $aVar . $bVar;
            }

            // b^2
            $b2Coeff = \App\Services\CAS\AxiomaticMath::power($bCoeff, 2);
            if ($b2Coeff != 0) {
                $terms[] = ($b2Coeff == 1 && $bVar ? '' : $b2Coeff) . ($bVar ? "{$bVar}^2" : "");
            }

            return empty($terms) ? "0" : implode(" + ", $terms);
        }, $expression);

        return $expression;
    }

    /**
     * Distributes constants over parentheses.
     * e.g., 2(3k + 1) => 6k + 2
     */
    protected function distributeConstants(string $expression): string
    {
        // Regex for c(a + b)
        return preg_replace_callback('/(\d+)\s*\(\s*(\d*[a-zA-Z]+)\s*\+\s*(\d+)\s*\)/', function ($matches) {
            $c = (float) $matches[1];

            preg_match('/(\d*)([a-zA-Z]+)/', $matches[2], $varParts);
            $a_coeff = empty($varParts[1]) ? 1.0 : (float) $varParts[1];
            $a_var = $varParts[2];

            $b = (float) $matches[3];

            $newCoeff = \App\Services\CAS\AxiomaticMath::multiply($c, $a_coeff);
            $newB = \App\Services\CAS\AxiomaticMath::multiply($c, $b);

            return "{$newCoeff}{$a_var} + {$newB}";
        }, $expression);
    }

    /**
     * Collects and sums terms with identical variables.
     * Note: This is a simplified version for common AST induction proofs.
     */
    protected function collectLikeTerms(string $expression): string
    {
        // Simple collection logic can be scaled up to 10,000s of lines over time.
        // For now, it cleans up redundant spaces and operations.
        $expression = preg_replace('/\s+/', ' ', $expression);
        $expression = str_replace(['+ +', '+ -', '- -'], ['+', '-', '+'], $expression);
        return $expression;
    }
}
