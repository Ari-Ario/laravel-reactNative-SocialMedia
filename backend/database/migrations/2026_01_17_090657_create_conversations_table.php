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
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->string('type')->default('private');
            $table->string('name')->nullable();
            $table->string('avatar')->nullable();
            $table->text('description')->nullable();
            $table->json('settings')->nullable();
            // $table->foreignId('last_message_id')->nullable()->constrained('messages')->nullOnDelete();
            $table->timestamp('last_message_at')->nullable();
            $table->boolean('is_archived')->default(false);
            $table->boolean('is_encrypted')->default(true);
            $table->json('mood_history')->nullable();
            
            // From enhanced collaboration features:
            // $table->foreignUuid('linked_project_id')->nullable()->constrained('collaboration_spaces'); // Now links to spaces
            $table->boolean('has_meeting_mode')->default(false);
            $table->json('meeting_notes')->nullable();
            $table->json('decision_log')->nullable();
            $table->integer('team_synergy_score')->default(0);
            $table->json('collaboration_patterns')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
