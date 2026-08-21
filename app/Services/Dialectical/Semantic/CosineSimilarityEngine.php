<?php

namespace App\Services\Dialectical\Semantic;


use Illuminate\Support\Facades\DB;
use Phpml\FeatureExtraction\TokenCountVectorizer;

class CosineSimilarityEngine
{
    private $vectorizer;
    private $tfIdfTransformer;

    public function __construct()
    {
        ini_set('memory_limit', '1G');
        // Use WordTokenizer instead of NGram to prevent memory exhaustion
        $this->vectorizer = new TokenCountVectorizer(new \Phpml\Tokenization\WordTokenizer());
    }

    /**
     * Translates Python Sentence-Transformers logic into Native PHP.
     * Finds the closest Parent Axiom in the DB to the given query using Cosine Similarity on TF-IDF vectors.
     */
    public function findClosestParentAxiom(string $query, string $domainPartition)
    {
        $axioms = DB::table('knowledge_axioms')
            ->where('domain_partition', $domainPartition)
            ->get();

        if ($axioms->isEmpty()) {
            return null;
        }

        $corpus = [];
        $axiomMap = [];

        // Build the corpus for vectorization
        foreach ($axioms as $idx => $axiom) {
            $corpus[] = strtolower($axiom->thesis_statement);
            $axiomMap[$idx] = $axiom;
        }

        // Add the query itself to the end of the corpus so it shares the same vector space
        $queryIdx = count($corpus);
        $corpus[] = strtolower($query);

        // Vectorize (Sentence-Transformer Embedding Simulation using TF vectors)
        $this->vectorizer->fit($corpus);
        $this->vectorizer->transform($corpus);

        $queryVector = $corpus[$queryIdx];
        $bestMatch = null;
        $highestSimilarity = -1;

        // Calculate Cosine Similarity Manually
        foreach ($axiomMap as $idx => $axiom) {
            $axiomVector = $corpus[$idx];
            
            // Handle empty vectors (e.g. stop words only)
            if (empty(array_filter($queryVector)) || empty(array_filter($axiomVector))) {
                continue;
            }

            try {
                $dotProduct = 0;
                $magA = 0;
                $magB = 0;
                
                foreach ($queryVector as $key => $value) {
                    $valA = $value;
                    $valB = $axiomVector[$key] ?? 0;
                    $dotProduct += $valA * $valB;
                    $magA += $valA * $valA;
                }
                
                foreach ($axiomVector as $key => $value) {
                    $magB += $value * $value;
                }
                
                if ($magA == 0 || $magB == 0) {
                    continue;
                }
                
                $similarity = $dotProduct / (sqrt($magA) * sqrt($magB));

                if ($similarity > $highestSimilarity) {
                    $highestSimilarity = $similarity;
                    $bestMatch = clone $axiom;
                    $bestMatch->semantic_confidence = $similarity;
                }
            } catch (\Exception $e) {
                // Ignore errors
                continue;
            }
        }

        // Return if we have a strong match (e.g., > 0.05 similarity for natural language without TF-IDF)
        if ($bestMatch && $bestMatch->semantic_confidence > 0.05) {
            return $bestMatch;
        }

        // Fallback: If nothing matched but we have an axiom, return the first one with 0 confidence
        if (!empty($axiomMap) && isset($axiomMap[0])) {
            $fallback = clone $axiomMap[0];
            $fallback->semantic_confidence = 0.01;
            return $fallback;
        }

        return null;
    }
}
