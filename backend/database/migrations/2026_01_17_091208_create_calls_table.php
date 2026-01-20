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
        Schema::create('calls', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('conversation_id')->constrained();
            $table->foreignId('initiator_id')->constrained('users');
            $table->string('type');
            $table->string('status')->default('ringing');
            $table->json('participants');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->integer('duration_seconds')->nullable();
            $table->json('call_quality_metrics')->nullable();
            $table->text('recording_path')->nullable();
            $table->boolean('is_web_compatible')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('calls');
    }
};
