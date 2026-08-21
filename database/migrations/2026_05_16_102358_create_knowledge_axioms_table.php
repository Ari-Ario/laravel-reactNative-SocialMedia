<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('knowledge_axioms', function (Blueprint $table) {
            // We cannot use standard $table->id() because partitioning requires the partition key to be in the Primary Key.
            // So we define it manually.
            $table->bigInteger('id', true)->unsigned();
            $table->string('domain_partition')->default('formal_logic'); // Cannot be nullable if in PK
            
            // To allow foreign key references, parent_axiom_id doesn't strictly need to include partition, but 
            // since we're using a composite PK on the referenced table, Laravel foreign keys might be tricky.
            // In a partitioned setup for high scalability, we often drop hard FK constraints and enforce them in code.
            // For now, we will just store the IDs.
            $table->unsignedBigInteger('parent_axiom_id')->nullable()->index();
            $table->unsignedBigInteger('anti_thesis_id')->nullable()->index();
            
            $table->string('branch')->index(); // Mathematics, Physics, Chemistry, Computer Science
            $table->string('data_type')->default('text'); // math_formula, empirical_dataset, text_corpus, image_analysis
            $table->string('source_type')->default('user'); // user, rag_pipeline, vision_ai, math_engine
            
            $table->text('thesis_statement');
            $table->text('formal_proof')->nullable(); // Explains the mathematical/logical mechanism
            $table->text('context_description')->nullable(); // Explains the axiom in plain English
            $table->string('ast_signature', 64)->nullable()->index(); // Unique hash of parsed AST logic
            $table->json('deductive_samples')->nullable(); // Small sample test data
            $table->text('inductive_logic')->nullable(); // The exact n -> n+1 algebraic proof
            $table->float('confidence_score')->default(0.5); // 0.0 to 1.0 (Pancracy metric)
            $table->boolean('expert_review_required')->default(false); // Flags Millennium/Unsolved problems
            
            $table->enum('status', ['synthesized_thesis', 'global_axiom', 'soft_axiom'])->default('synthesized_thesis');
            $table->timestamps();

            $table->primary(['id', 'domain_partition']);

            // Performance Indexes for high-concurrency lookup
            $table->index(['status', 'branch']);
            $table->index(['source_type', 'data_type']);
        });

        // Add MySQL Native Partitioning (KEY partitioning automatically hashes the string, preventing crashes on unknown domains)
        \Illuminate\Support\Facades\DB::statement("
            ALTER TABLE knowledge_axioms PARTITION BY KEY(domain_partition) PARTITIONS 8;
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('knowledge_axioms');
    }
};
