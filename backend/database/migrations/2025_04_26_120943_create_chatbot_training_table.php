<?php

// database/migrations/[timestamp]_create_chatbot_training_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;


return new class extends Migration {
    public function up()
    {
        Schema::create('chatbot_training', function (Blueprint $table) {
            $table->id();
            $table->string('trigger')->comment('User message pattern');
            $table->text('response')->comment('Bot response');
            $table->string('context')->nullable()->comment('Optional conversation context');
            $table->json('keywords')->nullable()->comment('Associated keywords');
            $table->string('category')->nullable()->comment('account/payment/features etc');
            $table->boolean('needs_review')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('trained_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('trigger');
            $table->index('category');
            $table->foreign('trained_by')->references('id')->on('users');

            // collaboration-specific fields from enhanced features
            $table->string('collaboration_context')->nullable(); // 'brainstorm', 'meeting', 'conflict'
            $table->json('space_types')->nullable(); // Which space types this applies to
            $table->integer('usage_count')->default(0); // How often used successfully
            $table->decimal('success_rate', 5, 2)->default(0); // How helpful it was
            $table->json('triggers_from_data')->nullable(); // Auto-trigger conditions
        });
    }

    public function down()
    {
        Schema::dropIfExists('chatbot_training');
    }
};
