<?php

namespace App\Services\Dialectical\Semantic;

class SemanticDatasetManager
{
    /**
     * Replicates the "instruction/output" JSON format of LLaMA-Factory.
     * We map sentences to scientific domains.
     */
    public static function getTrainingCorpus(): array
    {
        // Completely Dynamic System: Fetch training corpus natively from the database Axioms
        // mimicking LLaMA-Factory JSONL ingestion but doing it via active memory layer
        $baseCorpus = [];
        
        try {
            // Only try if the DB table exists (prevents migration errors)
            if (\Illuminate\Support\Facades\Schema::hasTable('knowledge_axioms')) {
                $axioms = \Illuminate\Support\Facades\DB::table('knowledge_axioms')
                            ->select('thesis_statement', 'context_description', 'domain_partition', 'branch')
                            ->whereNotNull('domain_partition')
                            ->get();
                            
                foreach ($axioms as $axiom) {
                    $text = $axiom->thesis_statement;
                    if (!empty($axiom->context_description)) {
                        $text .= ' ' . $axiom->context_description;
                    }
                    $baseCorpus[] = [$text, $axiom->domain_partition];
                }
            }
        } catch (\Exception $e) {
            // Fallback empty if db not ready during early boot
        }

        // Add core logical fallacies/tautologies that might not be seeded in Axioms
        $baseCorpus[] = ["modus ponens", "formal_logic"];
        $baseCorpus[] = ["modus tollens", "formal_logic"];
        $baseCorpus[] = ["affirming the consequent", "formal_logic"];
        $baseCorpus[] = ["precision, recall formula", "empirical_science"];
        $baseCorpus[] = ["sum of i from 1 to n", "algebraic_summation"];
        $baseCorpus[] = ["sum of squares", "algebraic_summation"];

        // Read from LLaMA-Factory style JSONL if exists (Python fine-tuning translation)
        $jsonlCorpus = DatasetIngestionService::ingestJsonl(storage_path('app/train.jsonl'));
        if (!empty($jsonlCorpus)) {
            $baseCorpus = array_merge($baseCorpus, $jsonlCorpus);
        }

        return $baseCorpus;
    }
}
