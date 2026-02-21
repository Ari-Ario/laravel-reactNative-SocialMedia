<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    // database/migrations/xxxx_create_polls_table.php
    public function up()
    {
        Schema::create('polls', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('space_id');
            $table->unsignedBigInteger('created_by');
            $table->string('question');
            $table->enum('type', ['single', 'multiple', 'ranked', 'weighted'])->default('single');
            $table->json('settings');
            $table->timestamp('deadline')->nullable();
            $table->json('tags')->nullable();
            $table->enum('status', ['draft', 'active', 'closed', 'archived'])->default('active');
            $table->integer('total_votes')->default(0);
            $table->integer('unique_voters')->default(0);
            $table->json('forwarded_from')->nullable();
            $table->uuid('parent_poll_id')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->timestamps();

            $table->foreign('space_id')->references('id')->on('collaboration_spaces')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
        });

        Schema::create('poll_options', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('poll_id');
            $table->string('text');
            $table->integer('votes')->default(0);
            $table->timestamps();

            $table->foreign('poll_id')->references('id')->on('polls')->onDelete('cascade');
        });

        Schema::create('poll_votes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('poll_id');
            $table->uuid('option_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamps();

            $table->foreign('poll_id')->references('id')->on('polls')->onDelete('cascade');
            $table->foreign('option_id')->references('id')->on('poll_options')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');

            $table->unique(['poll_id', 'user_id', 'option_id'], 'unique_vote');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('polls');
    }
};