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
        Schema::create('stories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('media_path');
            $table->string('caption')->nullable();
            $table->timestamp('expires_at');

            // Enhancements from simplified + AI:
            $table->boolean('is_collaborative')->default(false);
            $table->json('collaborators')->nullable();
            $table->integer('chain_length')->default(1);
            $table->uuid('parent_story_id')->nullable();
            $table->json('branch_options')->nullable();
            $table->json('interactive_elements')->nullable();
            $table->json('viewer_reactions_summary')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stories');
    }
};
