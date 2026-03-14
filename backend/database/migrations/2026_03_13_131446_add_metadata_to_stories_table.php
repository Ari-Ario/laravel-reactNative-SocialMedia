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
        Schema::table('stories', function (Blueprint $table) {
            $table->json('location')->nullable()->after('caption');
            $table->json('stickers')->nullable()->after('location');
            $table->enum('type', ['photo', 'video'])->default('photo')->after('media_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->dropColumn(['location', 'stickers', 'type']);
        });
    }
};