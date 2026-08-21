<?php

namespace App\Services\Dialectical\Semantic;

use Illuminate\Support\Facades\DB;

class SemanticEngine
{
    private string $storagePath;
    private string $vectorsFile;
    private string $metaFile;

    public function __construct()
    {
        $this->storagePath = storage_path('app/dialectical_semantic');
        if (!is_dir($this->storagePath)) {
            mkdir($this->storagePath, 0755, true);
        }
        $this->vectorsFile = $this->storagePath . '/vectors.json';
        $this->metaFile = $this->storagePath . '/meta.json';
    }

    /**
     * Train the TF-IDF Matrix on all database axioms
     */
    public function train(): void
    {
        echo "Fetching axioms from database...\n";
        $axioms = DB::table('knowledge_axioms')
            ->where('status', 'global_axiom')
            ->orWhere('expert_review_required', true)
            ->select('id', 'thesis_statement', 'domain_partition', 'branch')
            ->get();

        $documents = [];
        $metadata = [];
        $documentFrequency = [];

        echo "Tokenizing " . count($axioms) . " axioms...\n";
        
        foreach ($axioms as $idx => $axiom) {
            // Combine thesis with domain and branch to give semantic weighting to the partition
            $text = $axiom->thesis_statement . ' ' . $axiom->domain_partition . ' ' . $axiom->branch;
            $tokens = $this->tokenize($text);
            
            // Count Term Frequency (TF)
            $tf = [];
            foreach ($tokens as $token) {
                if (!isset($tf[$token])) {
                    $tf[$token] = 0;
                }
                $tf[$token]++;
            }
            
            // Track Document Frequency (DF)
            foreach (array_keys($tf) as $token) {
                if (!isset($documentFrequency[$token])) {
                    $documentFrequency[$token] = 0;
                }
                $documentFrequency[$token]++;
            }

            $documents[] = $tf;
            $metadata[] = [
                'id' => $axiom->id,
                'thesis' => $axiom->thesis_statement,
                'domain' => $axiom->domain_partition
            ];
        }

        $totalDocuments = count($documents);
        $idf = [];
        echo "Calculating Inverse Document Frequencies (IDF)...\n";
        
        foreach ($documentFrequency as $token => $df) {
            // Standard IDF formula: log(N / df)
            $idf[$token] = log($totalDocuments / (1 + $df));
        }

        echo "Generating sparse TF-IDF vectors...\n";
        $vectors = [];
        
        foreach ($documents as $idx => $tf) {
            $vector = [];
            $norm = 0;
            foreach ($tf as $token => $count) {
                $weight = $count * ($idf[$token] ?? 0);
                $vector[$token] = $weight;
                $norm += $weight * $weight;
            }
            
            // L2 Normalize the vector so cosine similarity is just dot product
            $norm = sqrt($norm);
            if ($norm > 0) {
                foreach ($vector as $token => $weight) {
                    $vector[$token] = $weight / $norm;
                }
            }
            
            $vectors[] = $vector;
        }

        echo "Saving matrix to disk...\n";
        file_put_contents($this->vectorsFile, json_encode(['idf' => $idf, 'matrix' => $vectors]));
        file_put_contents($this->metaFile, json_encode($metadata));
        
        echo "Training complete! Saved " . count($vectors) . " vectors.\n";
    }

    /**
     * Query the vector space to find the closest axiom
     */
    public function query(string $thesis, ?string $filterPartition = null): array
    {
        if (!file_exists($this->vectorsFile) || !file_exists($this->metaFile)) {
            throw new \Exception("Semantic Engine not trained. Run php artisan dialectical:train-ontology");
        }

        $vectorsData = json_decode(file_get_contents($this->vectorsFile), true);
        $metadata = json_decode(file_get_contents($this->metaFile), true);

        $idf = $vectorsData['idf'];
        $matrix = $vectorsData['matrix'];

        // Vectorize the query
        $tokens = $this->tokenize($thesis);
        $tf = [];
        foreach ($tokens as $token) {
            if (!isset($tf[$token])) {
                $tf[$token] = 0;
            }
            $tf[$token]++;
        }

        $queryVector = [];
        $norm = 0;
        foreach ($tf as $token => $count) {
            if (isset($idf[$token])) {
                $weight = $count * $idf[$token];
                $queryVector[$token] = $weight;
                $norm += $weight * $weight;
            }
        }

        $norm = sqrt($norm);
        if ($norm > 0) {
            foreach ($queryVector as $token => $weight) {
                $queryVector[$token] = $weight / $norm;
            }
        }

        // Calculate Cosine Similarity (Dot Product of normalized vectors)
        $scores = [];
        foreach ($matrix as $idx => $axiomVector) {
            $score = 0;
            // Only iterate through the tokens present in the query
            foreach ($queryVector as $token => $qWeight) {
                if (isset($axiomVector[$token])) {
                    $score += $qWeight * $axiomVector[$token];
                }
            }
            $scores[$idx] = $score;
        }

        // Sort descending
        arsort($scores);

        $results = [];
        foreach ($scores as $idx => $score) {
            $meta = $metadata[$idx];
            
            if ($filterPartition && strtolower($filterPartition) !== strtolower($meta['domain'])) {
                continue;
            }
            
            $results[] = [
                'id' => $meta['id'],
                'thesis' => $meta['thesis'],
                'domain' => $meta['domain'],
                'similarity' => $score
            ];

            if (count($results) >= 5) {
                break;
            }
        }

        return $results;
    }

    /**
     * Highly customized tokenizer that tracks math symbols and structure
     */
    private function tokenize(string $text): array
    {
        return (new AdvancedSemanticParser())->tokenize($text);
    }
}
