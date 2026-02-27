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
        Schema::table('media', function (Blueprint $table) {
            // Change model_id to string to support UUIDs
            $table->string('model_id')->change();
            
            // Add user_id and metadata if they don't exist
            if (!Schema::hasColumn('media', 'user_id')) {
                $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            }
            if (!Schema::hasColumn('media', 'metadata')) {
                $table->json('metadata')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('media', function (Blueprint $table) {
            $table->unsignedBigInteger('model_id')->change();
            $table->dropColumn(['user_id', 'metadata']);
        });
    }
};
