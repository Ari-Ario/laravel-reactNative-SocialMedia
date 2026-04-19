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
        Schema::table('posts', function (Blueprint $table) {
            $table->index('created_at');
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->index('created_at');
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->index('created_at');
            $table->index('conversation_id');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['notifiable_id', 'notifiable_type', 'read_at']);
        });

        Schema::table('space_participations', function (Blueprint $table) {
            $table->index(['space_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
            $table->dropIndex(['conversation_id']);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['notifiable_id', 'notifiable_type', 'read_at']);
        });

        Schema::table('space_participations', function (Blueprint $table) {
            $table->dropIndex(['space_id', 'user_id']);
        });
    }
};
