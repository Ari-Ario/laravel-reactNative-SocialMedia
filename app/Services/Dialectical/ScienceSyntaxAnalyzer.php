<?php

namespace App\Services\Dialectical;

/**
 * ScienceSyntaxAnalyzer
 * 
 * Inspects a thesis for mathematical, algebraic, and scientific markers.
 * Used to prevent pure formal logic / linguistic routing overrides from 
 * aggressively capturing math and science queries.
 */
class ScienceSyntaxAnalyzer
{
    /**
     * Determine if a string contains mathematical symbols, equations, 
     * algebraic variables, or domain-specific scientific keywords.
     * 
     * @param string $text
     * @return bool
     */
    public function isMathOrScientificExpression(string $text): bool
    {
        $textLower = strtolower($text);

        // 1. Equations, inequalities, and arithmetic operators (excluding pure linguistic logic if possible)
        // Look for =, <, >, +, *, /, ^
        // (Minus is tricky due to hyphens, so we check for spaced hyphen or surrounding digits/vars)
        if (preg_match('/[=\^\*\+\/<>]|<=|>=|!=|==|!==/', $textLower)) {
            return true;
        }

        // 1.5 Trigonometric and Logarithmic functions
        if (preg_match('/\b(sin|cos|tan|log|ln|exp|sqrt)\s*\(/i', $textLower)) {
            return true;
        }

        if (preg_match('/(?:\d+\s*-\s*\d+|[a-z]\s*-\s*\d+|\d+\s*-\s*[a-z]|[a-z]\s*-\s*[a-z])/', $textLower)) {
            return true;
        }

        // 2. Dynamic Database Vocabulary Intersection
        // Load the dynamically extracted science/math vocabulary from all current and future axioms
        $vocabPath = storage_path('app/science_vocabulary.json');
        if (file_exists($vocabPath)) {
            $scienceVocab = json_decode(file_get_contents($vocabPath), true) ?? [];
            if (!empty($scienceVocab)) {
                // Tokenize the thesis and check if it contains any of the scientific vocabulary
                $tokenizer = new \App\Services\Dialectical\Semantic\MathAwareTokenizer();
                $tokens = $tokenizer->tokenize($textLower);
                $vocabLookup = array_flip($scienceVocab);

                foreach ($tokens as $token) {
                    // Only match substantial tokens to avoid false positives on common short words
                    if (strlen($token) > 3 && isset($vocabLookup[$token])) {
                        return true; // We found a word that uniquely belongs to a science/math axiom!
                    }
                }
            }
        } else {
            // Fallback just in case training hasn't run yet
            if (preg_match('/\b(divides|mod|modulo|factorial|sqrt|sum|integral|prime|even|odd|collatz|theorem|calculus|algebra|polynomial|equation|formula|velocity|mass|force|gravity|quantum|molecule|atom|gene|dna|rna|cell|tissue|chromosome|metabolism|thermodynamics|entropy|enthalpy|catalyst|kinetics|orbit|planet|star|galaxy)\b/i', $textLower)) {
                return true;
            }
        }

        // 3. Standalone algebraic variable equations (e.g. "let x be", "n is")
        if (preg_match('/\b[a-z]\s*=\s*[0-9a-z]/i', $textLower)) {
            return true;
        }
        
        // 4. Algebraic exponents (x^2, n^m, 2^n)
        if (preg_match('/[a-z0-9]\^[a-z0-9]/i', $textLower)) {
            return true;
        }

        return false;
    }
}
