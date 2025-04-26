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
        });
    }

    public function down()
    {
        Schema::dropIfExists('chatbot_training');
    }
};
