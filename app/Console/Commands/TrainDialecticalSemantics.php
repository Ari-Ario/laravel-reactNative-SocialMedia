<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\Dialectical\Semantic\SemanticRouterService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TrainDialecticalSemantics extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'dialectical:train-semantics';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Advanced ML training command for the Dialectical Semantic Router (Cross-Validation, Chunking, Partition Stats).';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        ini_set('memory_limit', '-1'); // Crucial for ML vocabulary vectors
        $startTime = microtime(true);

        $this->info('====================================================');
        $this->info(' 🧠 INITIALIZING DIALECTICAL SEMANTIC ENGINE ML TRAINER');
        $this->info('====================================================');

        // 1. Pre-calculate totals for Progress Bar
        $totalAxioms = DB::table('knowledge_axioms')->count();
        if ($totalAxioms === 0) {
            $this->error('No axioms found in knowledge_axioms table. Please run db:seed or dialectic:seed-knowledge first.');
            return 1;
        }

        $this->info("Found {$totalAxioms} Axioms. Beginning Memory-Safe Chunk Extraction...");
        
        $bar = $this->output->createProgressBar($totalAxioms);
        $bar->start();

        $samples = [];
        $labels = [];
        $testSamples = [];
        $testLabels = [];
        
        $partitionStats = [];
        $unmappedCount = 0;

        $scienceVocabulary = [];
        $tokenizer = new \App\Services\Dialectical\Semantic\MathAwareTokenizer();
        
        // 2. Memory-Safe Chunking (500 axioms per block)
        DB::table('knowledge_axioms')
            ->select('thesis_statement', 'domain_partition')
            ->orderBy('id')
            ->chunk(500, function ($axioms) use ($bar, &$samples, &$labels, &$testSamples, &$testLabels, &$partitionStats, &$unmappedCount, &$scienceVocabulary, $tokenizer) {
                foreach ($axioms as $axiom) {
                    $text = strtolower(trim($axiom->thesis_statement));
                    $domain = $axiom->domain_partition;

                    if (empty($domain)) {
                        $domain = 'general';
                        $unmappedCount++;
                    }

                    // Track stats
                    if (!isset($partitionStats[$domain])) {
                        $partitionStats[$domain] = 0;
                    }
                    $partitionStats[$domain]++;

                    // Build Science/Math vocabulary dynamically
                    if ($domain !== 'formal_logic' && $domain !== 'general' && strpos($domain, 'logic') === false) {
                        $tokens = $tokenizer->tokenize($text);
                        foreach ($tokens as $t) {
                            if (strlen($t) > 2 || preg_match('/^[=\^\*\+\/<>]$/', $t)) {
                                $scienceVocabulary[$t] = true;
                            }
                        }
                    }

                    // 10% Cross-Validation Split
                    if (rand(1, 100) <= 10) {
                        $testSamples[] = $text;
                        $testLabels[] = $domain;
                    } else {
                        $samples[] = $text;
                        $labels[] = $domain;
                    }

                    $bar->advance();
                }
            });

        $bar->finish();
        $this->newLine(2);

        // Save the dynamic vocabulary
        $vocabList = array_keys($scienceVocabulary);
        file_put_contents(storage_path('app/science_vocabulary.json'), json_encode($vocabList));
        $this->info("🔬 Cached " . count($vocabList) . " unique math/science tokens.");

        // 3. Output Partition Statistics
        $this->info('📊 Partition Distribution Statistics:');
        $headers = ['Domain Partition', 'Axiom Count', 'Percentage'];
        $rows = [];
        foreach ($partitionStats as $domain => $count) {
            $percentage = round(($count / $totalAxioms) * 100, 2);
            $rows[] = [$domain, $count, "{$percentage}%"];
        }
        $this->table($headers, $rows);

        if ($unmappedCount > 0) {
            $this->warn("Warning: {$unmappedCount} axioms were missing a domain_partition and defaulted to 'general'.");
        }

        // 4. Model Training Phase
        $this->info('⚙️ Compiling Vector Matrix and Training NaiveBayes Classifier...');
        $memBefore = round(memory_get_usage() / 1048576, 2);
        
        $service = new SemanticRouterService();
        $service->trainModelWithData($samples, $labels);

        $memAfter = round(memory_get_usage() / 1048576, 2);

        // 5. Cross-Validation Phase
        $this->info('🧪 Running Cross-Validation on Test Set...');
        $correct = 0;
        $totalTest = count($testSamples);
        
        foreach ($testSamples as $index => $testText) {
            $predicted = $service->classify($testText);
            if ($predicted === $testLabels[$index]) {
                $correct++;
            }
        }
        
        $accuracy = $totalTest > 0 ? round(($correct / $totalTest) * 100, 2) : 0;
        
        $executionTime = round(microtime(true) - $startTime, 2);

        $this->info('====================================================');
        $this->info(' ✅ TRAINING COMPLETE');
        $this->info('====================================================');
        $this->line("- Total Training Samples : " . count($samples));
        $this->line("- Total Testing Samples  : " . $totalTest);
        $this->line("- Model Accuracy Score   : " . ($accuracy >= 90 ? "<fg=green>{$accuracy}%</>" : "<fg=yellow>{$accuracy}%</>"));
        $this->line("- Memory Peak Usage      : {$memAfter} MB (delta: " . ($memAfter - $memBefore) . " MB)");
        $this->line("- Total Execution Time   : {$executionTime} seconds");
        $this->line("- Model Saved To         : storage/app/dialectical_semantic_model.bin");

        return 0;
    }
}
