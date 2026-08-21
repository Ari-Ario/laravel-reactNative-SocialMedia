<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class SolveUnsolvedProblem extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'dialectic:solve {question : The unsolved problem or theory to mathematically parse}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Dynamically traces an unproven theory to its binary roots and synthesizes a dialectical proof.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $question = $this->argument('question');
        $this->info("🧠 Dialectical Engine Initiating Total Study on: \"{$question}\"");
        $this->line("Tracing structural parents down to binary roots (0/1)...\n");

        $oracle = app(\App\Services\DialecticalOracleService::class);
        $result = $oracle->solveUnprovenTheory($question);

        if (!$result) {
            $this->error("Failed to map the theory to existing axioms. The problem lacks formal logical parameters in the database.");
            return;
        }

        $this->info("✅ Trace Complete! Mathematical Pedigree:");
        foreach ($result['pedigree'] as $index => $node) {
            $this->line("  ↳ [L-{$index}] ID: {$node->id} | {$node->thesis_statement}");
        }

        $this->info("\n⚛️ Synthesized Proof Matrix:");
        $this->line($result['proof']);

        $this->info("\n💾 Saving to Pancratic Review System (chatbot_training)...");

        \App\Models\ChatbotTraining::create([
            'trigger' => 'PROOF SYNTHESIS: ' . substr($question, 0, 100),
            'response' => $result['proof'],
            'keywords' => 'unsolved, millennium, synthesis, ' . ($result['pedigree'][0]->domain_partition ?? 'logic'),
            'usage_count' => 0,
            'success_rate' => 0.00,
            'needs_review' => true,
            'is_active' => false,
            'context' => json_encode([
                'type' => 'dialectical_synthesis',
                'pedigree_depth' => count($result['pedigree']),
                'root_axiom' => $result['pedigree'][count($result['pedigree']) - 1]->thesis_statement ?? null,
                'target_theory' => $question
            ]),
            'parent_axiom_id' => $result['pedigree'][0]->id ?? null
        ]);

        $this->info("✅ Proof successfully queued for human expert review.");
    }
}
