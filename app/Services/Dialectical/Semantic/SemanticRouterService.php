<?php

namespace App\Services\Dialectical\Semantic;

use Phpml\Classification\NaiveBayes;
use Phpml\FeatureExtraction\TokenCountVectorizer;
use Phpml\Tokenization\WordTokenizer;
use App\Services\Dialectical\Semantic\NGramTokenizer;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class SemanticRouterService
{
    private $classifier;
    private $vectorizer;
    private $tfIdfTransformer;
    private $modelPath;

    public function __construct()
    {
        ini_set('memory_limit', '-1'); // Unlimited memory required for large vocabulary sparse matrix
        $this->modelPath = storage_path('app/dialectical_semantic_model.bin');
        $this->loadOrTrainModel();
    }

    private function loadOrTrainModel()
    {
        if (file_exists($this->modelPath)) {
            try {
                $savedState = unserialize(file_get_contents($this->modelPath));
                $this->classifier = $savedState['classifier'];
                $this->vectorizer = $savedState['vectorizer'];
                $this->tfIdfTransformer = $savedState['tfIdfTransformer'];
                return;
            } catch (\Exception $e) {
                Log::warning("Failed to load semantic model: " . $e->getMessage() . ". Retraining...");
            }
        }

        $this->trainModel();
    }

    public function trainModel()
    {
        $corpus = SemanticDatasetManager::getTrainingCorpus();
        
        $samples = [];
        $labels = [];

        foreach ($corpus as $row) {
            $samples[] = strtolower($row[0]);
            $labels[] = $row[1];
        }

        $this->trainModelWithData($samples, $labels);
    }

    /**
     * Train the model dynamically from an advanced script (avoids fetching all at once in one heavy array).
     */
    public function trainModelWithData(array $samples, array $labels)
    {
        // 1. Vectorize (Using MathAwareTokenizer to preserve equations and scientific symbols)
        $this->vectorizer = new TokenCountVectorizer(new \App\Services\Dialectical\Semantic\MathAwareTokenizer());
        $this->vectorizer->fit($samples);
        $this->vectorizer->transform($samples);

        // 2. Apply TF-IDF Transformer to weight rare scientific terms heavily
        $this->tfIdfTransformer = new \Phpml\FeatureExtraction\TfIdfTransformer($samples);
        $this->tfIdfTransformer->fit($samples);
        $this->tfIdfTransformer->transform($samples);

        // 3. Train Classifier
        $this->classifier = new NaiveBayes();
        $this->classifier->train($samples, $labels);

        // Save for instant loading (2GB RAM optimization)
        file_put_contents($this->modelPath, serialize([
            'classifier' => $this->classifier,
            'vectorizer' => $this->vectorizer,
            'tfIdfTransformer' => $this->tfIdfTransformer
        ]));
        
        Log::info("Semantic Engine Retrained and Cached successfully.");
    }

    /**
     * Classifies a natural language query into a scientific domain.
     */
    public function classify(string $query): string
    {
        $query = strtolower($query);
        $samples = [$query];

        $this->vectorizer->transform($samples);
        
        if ($this->tfIdfTransformer) {
            $this->tfIdfTransformer->transform($samples);
        }

        $prediction = $this->classifier->predict($samples);

        return $prediction[0] ?? 'general';
    }
}
