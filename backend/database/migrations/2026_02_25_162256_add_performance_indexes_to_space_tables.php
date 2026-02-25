<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('collaboration_spaces', function (Blueprint $table) {
            $table->index('updated_at');
        });

        Schema::table('space_participations', function (Blueprint $table) {
            $table->index(['user_id', 'last_active_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('collaboration_spaces', function (Blueprint $table) {
            $table->dropIndex(['updated_at']);
        });

        Schema::table('space_participations', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'last_active_at']);
        });
    }
};