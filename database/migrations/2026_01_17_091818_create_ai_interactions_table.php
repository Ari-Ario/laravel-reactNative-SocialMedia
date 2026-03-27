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
        Schema::create('ai_interactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('space_id')->nullable()->constrained('collaboration_spaces');
            $table->foreignId('user_id')->nullable()->constrained('users');
            $table->foreignId('triggered_by_post_id')->nullable()->constrained('posts');
            
            // Interaction details
            $table->string('interaction_type'); // 'question', 'suggestion', 'summary', 'moderation', 'inspiration'
            $table->text('user_input')->nullable();
            $table->text('ai_response')->nullable();
            
            // Context from chatbot_training
            $table->foreignId('training_match_id')->nullable()->constrained('chatbot_training');
            $table->json('context_data')->nullable(); // Additional context from the space
            
            // Feedback for learning
            $table->boolean('was_helpful')->nullable();
            $table->json('user_feedback')->nullable();
            
            // Performance metrics
            $table->decimal('confidence_score', 5, 2)->default(0);
            $table->integer('response_time_ms')->nullable();
            
            $table->timestamps();
            $table->index(['space_id', 'created_at']);
            $table->index(['user_id', 'interaction_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_interactions');
    }
};
