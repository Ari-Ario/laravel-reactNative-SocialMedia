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
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->text('caption')->nullable();

            // Enhancements from simplified + AI:
            $table->boolean('is_collaborative')->default(false);
            $table->json('collaborators')->nullable();
            $table->integer('collaborator_count')->default(0);
            $table->integer('version')->default(1);
            $table->foreignId('parent_version_id')->nullable()->constrained('posts')->onDelete('set null');
            $table->json('edit_history')->nullable();
            $table->boolean('accepting_contributions')->default(false);
            $table->string('contribution_guidelines')->nullable();
            $table->json('voice_annotations')->nullable();
            $table->json('empathy_overlays')->nullable();
            $table->json('growth_metrics')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
