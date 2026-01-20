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
        Schema::create('space_participations', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('space_id')->constrained('collaboration_spaces')->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('role')->default('participant');
            $table->json('permissions')->nullable();
            $table->json('presence_data')->nullable();
            $table->json('contribution_map')->nullable();
            $table->json('focus_areas')->nullable();
            $table->timestamp('last_active_at')->useCurrent();
            $table->json('cursor_state')->nullable();
            $table->json('audio_video_state')->nullable();
            $table->string('current_activity')->nullable();
            $table->json('reaction_stream')->nullable();
            $table->unique(['space_id', 'user_id']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('space_participations');
    }
};
