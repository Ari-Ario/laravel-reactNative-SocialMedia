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
        Schema::table('moderation_reports', function (Blueprint $table) {
            $table->unsignedBigInteger('assigned_to_id')->nullable()->after('check_id');
            $table->foreign('assigned_to_id')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('moderation_reports', function (Blueprint $table) {
            $table->dropForeign(['assigned_to_id']);
            $table->dropColumn('assigned_to_id');
        });
    }
};
