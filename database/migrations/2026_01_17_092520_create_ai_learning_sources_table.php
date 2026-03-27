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
        Schema::create('ai_learning_sources', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('ai_interaction_id')->constrained('ai_interactions')->cascadeOnDelete();
            
            // Link to ALL your existing tables for context
            $table->foreignId('related_post_id')->nullable()->constrained('posts');
            $table->foreignId('related_comment_id')->nullable()->constrained('comments');
            $table->foreignId('related_reaction_id')->nullable()->constrained('reactions');
            $table->foreignId('related_story_id')->nullable()->constrained('stories');
            $table->foreignId('related_conversation_id')->nullable()->constrained('conversations');
            $table->foreignId('related_media_id')->nullable()->constrained('media');
            
            // What the AI learned from this
            $table->json('extracted_patterns')->nullable();
            $table->json('learned_concepts')->nullable();
            $table->boolean('added_to_training')->default(false);
            
            $table->timestamps();
            $table->index(['ai_interaction_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_learning_sources');
    }
};
