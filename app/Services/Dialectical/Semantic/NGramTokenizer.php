<?php

namespace App\Services\Dialectical\Semantic;

use Phpml\Tokenization\Tokenizer;

class NGramTokenizer implements Tokenizer
{
    private int $minGram;
    private int $maxGram;

    public function __construct(int $minGram = 1, int $maxGram = 3)
    {
        $this->minGram = $minGram;
        $this->maxGram = $maxGram;
    }

    public function tokenize(string $text): array
    {
        // 1. Basic cleaning and spelling normalization
        $text = strtolower(trim($text));
        // Remove basic punctuation except numbers and letters
        $text = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $text);
        
        // 2. Explode into unigrams
        $words = preg_split('/\s+/', $text, -1, PREG_SPLIT_NO_EMPTY);
        
        $tokens = [];
        $wordCount = count($words);

        // 3. Generate N-Grams (e.g. Unigrams, Bigrams, Trigrams)
        for ($n = $this->minGram; $n <= $this->maxGram; $n++) {
            for ($i = 0; $i < $wordCount - $n + 1; $i++) {
                $gram = array_slice($words, $i, $n);
                $tokens[] = implode(' ', $gram);
            }
        }

        return $tokens;
    }
}
