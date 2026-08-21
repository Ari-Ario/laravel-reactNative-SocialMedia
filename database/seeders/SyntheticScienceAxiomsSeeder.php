<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Services\DialecticalOracleService;
use ReflectionClass;

class SyntheticScienceAxiomsSeeder extends Seeder
{
    public function run(): void
    {
        // Use reflection to access the private static getCompiledGraph array
        $reflection = new ReflectionClass(DialecticalOracleService::class);
        $method = $reflection->getMethod('getCompiledGraph');
        $method->setAccessible(true);
        $graph = $method->invoke(null);

        $this->command->info("=== Seeding Synthetic Science Axioms ===");

        $count = 0;
        foreach ($graph as $key => $node) {
            // Build a record that mimics a global axiom
            $cleanThesis = trim(str_ireplace('prove: ', '', strtolower($node['name'])));
            $astSignature = hash('sha256', $cleanThesis);

            // Deduce a partition based on the branch icon or name
            $partition = match ($node['branch_icon'] ?? '') {
                '🔢' => 'math_partition',
                '🌊', '🍎', '🌡️', '⚛️', '⚡' => 'physics_partition',
                '⚗️' => 'chemistry_partition',
                '🧬' => 'biology_partition',
                '📊', '🤝', '📈', '🌍', '🧠', '🏛️' => 'social_science_partition',
                '💻', '🖥️' => 'computer_science_partition',
                '🏗️' => 'engineering_partition',
                default => 'empirical_partition'
            };

            $formalProof = [
                'phase1' => $node['trial'] ?? '',
                'phase2' => $node['deductive_axiom'] ?? '',
                'phase3' => $node['inductive_limit'] ?? '',
                'synthesis' => $node['synthesis_note'] ?? '',
                'equation' => $node['equation'] ?? null,
                'equation_vars' => $node['equation_vars'] ?? null,
                'equation_result_label' => $node['equation_result_label'] ?? null,
            ];

            $axiomData = [
                'branch' => strtolower(str_replace(' ', '_', $node['name'])),
                'domain_partition' => $partition,
                'thesis_statement' => $node['name'],
                'formal_proof' => json_encode($formalProof, JSON_UNESCAPED_UNICODE),
                'context_description' => "Academic Ref: " . ($node['academic_ref'] ?? 'Unknown'),
                'ast_signature' => $astSignature,
                'parent_axiom_id' => null, // Parent linking could be done if needed
                'status' => 'global_axiom',
                'expert_review_required' => $node['unsolved'] ?? false,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            DB::table('knowledge_axioms')->updateOrInsert(
                ['ast_signature' => $astSignature],
                $axiomData
            );
            $count++;
        }

        $this->command->info("Processed {$count} hardcoded axioms into KnowledgeAxioms.");
    }
}
