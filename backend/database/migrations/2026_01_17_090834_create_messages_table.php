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
        Schema::create('messages', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignId('conversation_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->text('content')->nullable();
            $table->string('type')->default('text');
            $table->json('metadata')->nullable();

            $table->string('file_path')->nullable();
            $table->double('file_size')->nullable();
            $table->string('mime_type')->nullable();

            $table->json('reactions')->nullable();

            // ✅ FIX: self-referencing FK
            $table->uuid('reply_to_id')->nullable();
            $table->foreign('reply_to_id')
                ->references('id')
                ->on('messages')
                ->nullOnDelete();

            $table->boolean('is_edited')->default(false);
            $table->timestamp('edited_at')->nullable();

            $table->boolean('is_self_destruct')->default(false);
            $table->integer('view_timer_seconds')->nullable();

            $table->string('mood_detected')->nullable();

            $table->softDeletes();
            $table->timestamps();

            $table->index(['conversation_id', 'created_at']);
        });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
