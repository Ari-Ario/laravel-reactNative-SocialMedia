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
        Schema::table('comments', function (Blueprint $table) {
            $table->foreignId('market_item_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignId('post_id')->nullable()->change();
        });

        Schema::table('reactions', function (Blueprint $table) {
            $table->foreignId('market_item_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignId('post_id')->nullable()->change();
        });

        Schema::table('bookmarks', function (Blueprint $table) {
            $table->foreignId('market_item_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignId('post_id')->nullable()->change();
        });

        Schema::table('reposts', function (Blueprint $table) {
            $table->foreignId('market_item_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignId('post_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropForeign(['market_item_id']);
            $table->dropColumn('market_item_id');
        });

        Schema::table('reactions', function (Blueprint $table) {
            $table->dropForeign(['market_item_id']);
            $table->dropColumn('market_item_id');
        });

        Schema::table('bookmarks', function (Blueprint $table) {
            $table->dropForeign(['market_item_id']);
            $table->dropColumn('market_item_id');
        });

        Schema::table('reposts', function (Blueprint $table) {
            $table->dropForeign(['market_item_id']);
            $table->dropColumn('market_item_id');
        });
    }
};
