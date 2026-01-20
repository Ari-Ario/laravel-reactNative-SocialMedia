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
        Schema::create('magic_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('space_id')->constrained('collaboration_spaces')->onDelete('cascade');
            $table->foreignId('triggered_by')->nullable()->constrained('users');
            $table->string('event_type');
            $table->json('event_data');
            $table->json('context')->nullable();
            $table->json('impact')->nullable();
            $table->boolean('has_been_discovered')->default(false);
            $table->json('discovery_path')->nullable();
            $table->json('interactions')->nullable();
            $table->timestamps();
            $table->index(['space_id', 'event_type', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_events');
    }
};
