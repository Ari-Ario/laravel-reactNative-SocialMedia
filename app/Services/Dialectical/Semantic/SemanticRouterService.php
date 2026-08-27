<?php

namespace App\Services\Dialectical\Semantic;

use Phpml\Classification\NaiveBayes;
use Phpml\FeatureExtraction\TokenCountVectorizer;
use Phpml\Tokenization\WordTokenizer;
use Illuminate\Support\Facades\Log;

class SemanticRouterService
{
    /**
     * Static singleton state — loaded ONCE per Octane worker process.
     * In Swoole/Octane, static properties persist across requests within the
     * same worker, so the 372MB model is deserialized only on the FIRST
     * request that hits this worker. All subsequent requests reuse the
     * in-memory state at near-zero cost.
     */
    private static bool  $loaded    = false;
    private static bool  $available = false;
    private static mixed $classifier       = null;
    private static mixed $vectorizer       = null;
    private static mixed $tfIdfTransformer = null;

    private string $modelPath;

    public function __construct()
    {
        $this->modelPath = storage_path('app/dialectical_semantic_model.bin');

        if (!self::$loaded) {
            $this->bootStaticModel();
        }
    }

    /**
     * Load the serialized NaiveBayes model into static memory.
     * Called only once per worker. If the model file does not exist or
     * unserializing fails, we mark the service as unavailable and continue
     * without crashing — classify() will return null and the router falls
     * through to Layer 20.
     */
    private function bootStaticModel(): void
    {
        self::$loaded = true; // Mark as attempted even if it fails

        if (!file_exists($this->modelPath)) {
            Log::warning('SemanticRouterService: model file not found at ' . $this->modelPath . '. Layer 19 ML routing disabled. Run php artisan dialectical:train-semantics to build it.');
            self::$available = false;
            return;
        }

        try {
            // Raise memory limit for the deserialization — needed only once.
            ini_set('memory_limit', '-1');

            $savedState = unserialize(file_get_contents($this->modelPath));

            if (!isset($savedState['classifier'], $savedState['vectorizer'])) {
                throw new \RuntimeException('Serialized model file is corrupt or missing keys.');
            }

            self::$classifier       = $savedState['classifier'];
            self::$vectorizer       = $savedState['vectorizer'];
            self::$tfIdfTransformer = $savedState['tfIdfTransformer'] ?? null;
            self::$available        = true;

            Log::info('SemanticRouterService: NaiveBayes model loaded into static worker memory successfully.');
        } catch (\Throwable $e) {
            self::$available = false;
            Log::error('SemanticRouterService: Failed to load model — ' . $e->getMessage() . '. Layer 19 ML routing disabled.');
        }
    }

    /**
     * Train and persist the NaiveBayes model to disk.
     * Only called explicitly via artisan command — NEVER during an HTTP request.
     */
    public function trainModel(): void
    {
        $corpus  = SemanticDatasetManager::getTrainingCorpus();
        $samples = [];
        $labels  = [];

        foreach ($corpus as $row) {
            $samples[] = strtolower($row[0]);
            $labels[]  = $row[1];
        }

        $this->trainModelWithData($samples, $labels);
    }

    /**
     * Train the model with the provided data and save to disk.
     * After training, reset the static state so the next request reloads it.
     */
    public function trainModelWithData(array $samples, array $labels): void
    {
        ini_set('memory_limit', '-1');

        $vectorizer = new TokenCountVectorizer(new MathAwareTokenizer());
        $vectorizer->fit($samples);
        $vectorizer->transform($samples);

        $tfIdf = new \Phpml\FeatureExtraction\TfIdfTransformer($samples);
        $tfIdf->fit($samples);
        $tfIdf->transform($samples);

        $classifier = new NaiveBayes();
        $classifier->train($samples, $labels);

        file_put_contents($this->modelPath, serialize([
            'classifier'       => $classifier,
            'vectorizer'       => $vectorizer,
            'tfIdfTransformer' => $tfIdf,
        ]));

        // Reset static cache so next request reloads from disk
        self::$loaded    = false;
        self::$available = false;
        self::$classifier       = null;
        self::$vectorizer       = null;
        self::$tfIdfTransformer = null;

        Log::info('SemanticRouterService: Model retrained and saved. Static cache reset.');
    }

    /**
     * Classify a query into a scientific domain.
     *
     * Returns null (not empty string) when the ML model is unavailable,
     * so the router can safely fall through to Layer 20 without errors.
     */
    public function classify(string $query): ?string
    {
        if (!self::$available || self::$classifier === null || self::$vectorizer === null) {
            return null;
        }

        try {
            $query   = strtolower($query);
            $samples = [$query];

            self::$vectorizer->transform($samples);

            if (self::$tfIdfTransformer !== null) {
                self::$tfIdfTransformer->transform($samples);
            }

            $prediction = self::$classifier->predict($samples);
            return $prediction[0] ?? null;
        } catch (\Throwable $e) {
            Log::warning('SemanticRouterService::classify error — ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Check if the ML model is available in this worker.
     */
    public function isAvailable(): bool
    {
        return self::$available;
    }
}
