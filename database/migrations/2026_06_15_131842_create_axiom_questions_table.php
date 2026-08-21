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
        Schema::create('axiom_questions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->index(); // Who asked the question
            $table->unsignedBigInteger('knowledge_axiom_id')->nullable()->index(); // The root theorem/axiom
            
            // ML Semantic Pipeline Data
            $table->string('semantic_domain')->index(); // 'number_theory', 'empirical_science', etc.
            $table->decimal('semantic_confidence', 5, 4)->nullable(); // e.g. 0.9998 (confidence score)
            
            // User query and Engine response
            $table->text('user_question');
            $table->text('extracted_thesis')->nullable(); // The formal thesis parsed by the engine
            $table->text('derived_answer'); // The final result or formula
            
            // Dialectical Engine State
            $table->boolean('is_dialectically_verified')->default(false); // Did the 3-phase engine prove it?
            $table->boolean('is_fallacy')->default(false); // Did it collapse under Socratic filtering?
            $table->text('proof_trace')->nullable(); // The exact symbolic steps output by CAS/Solvers
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('axiom_questions');
    }
};
