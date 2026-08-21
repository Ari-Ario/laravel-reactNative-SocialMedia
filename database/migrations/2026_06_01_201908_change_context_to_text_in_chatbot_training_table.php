<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     * Phase 8/9 Enhancement: Dialectical promotion pipeline fields + expert domain routing.
     */
    public function up(): void
    {
        // 1. Existing: context column type change
        Schema::table('chatbot_training', function (Blueprint $table) {
            $table->text('context')->nullable()->change();
        });

        // 2. New dialectical promotion fields on chatbot_training
        Schema::table('chatbot_training', function (Blueprint $table) {
            if (!Schema::hasColumn('chatbot_training', 'branch')) {
                $table->string('branch', 100)->nullable()->after('category')
                    ->comment('Science branch for axiom promotion (e.g. formal_logic, relativity)');
            }
            if (!Schema::hasColumn('chatbot_training', 'domain_partition')) {
                $table->string('domain_partition', 100)->nullable()->after('branch')
                    ->comment('Sub-domain (e.g. propositional_logic, quantum_mechanics)');
            }
            if (!Schema::hasColumn('chatbot_training', 'parent_thesis')) {
                $table->text('parent_thesis')->nullable()->after('domain_partition')
                    ->comment('Expert-supplied parent axiom text for pedigree chain');
            }
            if (!Schema::hasColumn('chatbot_training', 'parent_axiom_id')) {
                $table->unsignedBigInteger('parent_axiom_id')->nullable()->after('parent_thesis')
                    ->comment('Resolved ID referencing partitioned knowledge_axioms table')->index();
            }
            if (!Schema::hasColumn('chatbot_training', 'formal_proof')) {
                $table->text('formal_proof')->nullable()->after('parent_axiom_id')
                    ->comment('Expert formal proof text for axiom insertion');
            }
            if (!Schema::hasColumn('chatbot_training', 'knowledge_axiom_id')) {
                $table->unsignedBigInteger('knowledge_axiom_id')->nullable()->after('formal_proof')
                    ->comment('Set after successful promotion to knowledge_axioms');
            }
            if (!Schema::hasColumn('chatbot_training', 'promoted_at')) {
                $table->timestamp('promoted_at')->nullable()->after('knowledge_axiom_id');
            }
        });

        // 3. New expert_domains table: per-branch expert routing
        if (!Schema::hasTable('expert_domains')) {
            Schema::create('expert_domains', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->string('branch', 100)
                    ->comment('Science branch this expert covers (e.g. formal_logic, genetics)');
                $table->string('domain_partition', 100)->nullable()
                    ->comment('Optional sub-domain specialization');
                $table->tinyInteger('phase')->default(0)
                    ->comment('1=Ontology, 2=Logic, 3=Math, 4=Physics/Chem, 5=Life/Earth, 6=Applied, 0=Superadmin');
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
                $table->unique(['user_id', 'branch'], 'expert_branch_unique');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('chatbot_training', function (Blueprint $table) {
            $table->string('context', 255)->nullable()->change();
        });

        Schema::table('chatbot_training', function (Blueprint $table) {
            $cols = [
                'branch',
                'domain_partition',
                'parent_thesis',
                'parent_axiom_id',
                'formal_proof',
                'knowledge_axiom_id',
                'promoted_at'
            ];
            foreach ($cols as $col) {
                if (Schema::hasColumn('chatbot_training', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::dropIfExists('expert_domains');
    }
};
