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
        Schema::create('collaboration_spaces', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('creator_id')->constrained('users')->onDelete('cascade');
            $table->string('space_type')->default('chat');
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('settings')->nullable();
            $table->json('content_state')->nullable();
            $table->foreignId('linked_conversation_id')->nullable()->constrained('conversations');
            $table->foreignId('linked_post_id')->nullable()->constrained('posts');
            $table->foreignId('linked_story_id')->nullable()->constrained('stories');
            $table->json('activity_metrics')->nullable();
            $table->integer('evolution_level')->default(1);
            $table->json('unlocked_features')->nullable();
            $table->boolean('is_live')->default(false);
            $table->json('live_participants')->nullable();
            $table->string('current_focus')->nullable();
            $table->json('emergence_triggers')->nullable();
            $table->timestamp('last_magic_at')->nullable();

            // AI enhancements for collaboration spaces:
            // AI assistant integration
            $table->boolean('has_ai_assistant')->default(false);
            $table->string('ai_personality')->nullable(); // 'helpful', 'creative', 'analytical', 'playful'
            $table->json('ai_capabilities')->nullable(); // ['summarize', 'suggest', 'moderate', 'inspire']
            $table->json('ai_learning_data')->nullable(); // What the AI has learned from this space
            
            $table->softDeletes();
            $table->timestamps();
            $table->index(['space_type', 'is_live']);
            $table->index(['creator_id', 'updated_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('collaboration_spaces');
    }
};
