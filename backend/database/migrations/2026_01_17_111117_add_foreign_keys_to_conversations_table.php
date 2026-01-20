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
        Schema::table('conversations', function (Blueprint $table) {
            // ✅ Safety check: only add if column doesn't exist
            if (!Schema::hasColumn('conversations', 'last_message_id')) {
                $table->foreignUuid('last_message_id')
                      ->nullable()
                      ->after('settings')
                      ->constrained('messages', 'id')
                      ->nullOnDelete()
                      ->change(); // Won't run if exists
            }

            if (!Schema::hasColumn('conversations', 'linked_project_id')) {
                $table->foreignUuid('linked_project_id')
                      ->nullable()
                      ->after('mood_history')
                      ->constrained('collaboration_spaces', 'id')
                      ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            // Drop constraints first, then columns
            $table->dropForeign(['last_message_id']);
            $table->dropColumn('last_message_id');
            
            $table->dropForeign(['linked_project_id']);
            $table->dropColumn('linked_project_id');
        });
    }
};
