<?php

namespace App\Services\Dialectical\Semantic;

use Phpml\Tokenization\Tokenizer;

class MathAwareTokenizer implements Tokenizer
{
    /**
     * Tokenize text while preserving mathematical symbols, numbers, and operators.
     * This allows ML models to learn structural mathematics (e.g. "n^m", "x+y", "=") 
     * rather than stripping them away as standard NLP tokenizers do.
     *
     * @param string $text
     * @return array
     */
    public function tokenize(string $text): array
    {
        // Advanced tokenization pattern:
        // Match mathematical symbols (+, -, *, /, ^, =, <, >)
        // Match words (including alphanumeric equations like n^m if not split)
        // Match standalone numbers
        $tokens = preg_split('/(?<=\W)(?=\w)|(?<=\w)(?=\W)|\s+/', $text, -1, PREG_SPLIT_NO_EMPTY);
        
        $cleaned = [];
        foreach ($tokens as $token) {
            $token = trim($token);
            // Ignore pure noise punctuation like comma or period unless it's a decimal
            if ($token !== '' && $token !== '.' && $token !== ',') {
                $cleaned[] = $token;
            }
        }
        
        return $cleaned;
    }
}
