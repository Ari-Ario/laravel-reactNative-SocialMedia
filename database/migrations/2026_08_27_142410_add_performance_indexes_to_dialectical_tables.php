<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Performance-critical DB indexes for the Dialectical AI Engine.
 *
 * Without these, the following queries do full-table scans at high traffic:
 *   - isUnsolvedProblem(): WHERE expert_review_required = 1
 *   - classifyDomain():    WHERE thesis_statement LIKE '%x%'  (exact match fallback)
 *   - Axiom bypass check:  WHERE status = 'global_axiom' AND thesis_statement = 'x'
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('knowledge_axioms', function (Blueprint $table) {
            // Composite index for the most common query pattern:
            // WHERE status = 'global_axiom' AND expert_review_required = 1
            if (!$this->indexExists('knowledge_axioms', 'ka_status_expert_review_idx')) {
                $table->index(['status', 'expert_review_required'], 'ka_status_expert_review_idx');
            }

            // thesis_statement is TEXT - MySQL cannot index full TEXT columns directly.
            // We add a generated stored column with a 191-char prefix for exact matching.
            // This covers: WHERE thesis_statement = 'x' fast (O(log n) vs O(n)).
            if (!$this->columnExists('knowledge_axioms', 'thesis_prefix')) {
                $table->string('thesis_prefix', 191)
                    ->storedAs('LEFT(thesis_statement, 191)')
                    ->nullable()
                    ->after('thesis_statement');
                $table->index('thesis_prefix', 'ka_thesis_prefix_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('knowledge_axioms', function (Blueprint $table) {
            if ($this->indexExists('knowledge_axioms', 'ka_status_expert_review_idx')) {
                $table->dropIndex('ka_status_expert_review_idx');
            }
            if ($this->columnExists('knowledge_axioms', 'thesis_prefix')) {
                $table->dropIndex('ka_thesis_prefix_idx');
                $table->dropColumn('thesis_prefix');
            }
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $indexes = \Illuminate\Support\Facades\DB::select(
            "SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$indexName]
        );
        return !empty($indexes);
    }

    private function columnExists(string $table, string $column): bool
    {
        return Schema::hasColumn($table, $column);
    }
};
