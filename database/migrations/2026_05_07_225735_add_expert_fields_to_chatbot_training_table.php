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
        Schema::table('chatbot_training', function (Blueprint $table) {
            if (!Schema::hasColumn('chatbot_training', 'confidence_score')) {
                $table->float('confidence_score')->default(0)->after('success_rate');
            }
            if (!Schema::hasColumn('chatbot_training', 'tags')) {
                $table->json('tags')->nullable()->after('confidence_score');
            }
            if (!Schema::hasColumn('chatbot_training', 'last_used_at')) {
                $table->timestamp('last_used_at')->nullable()->after('tags');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('chatbot_training', function (Blueprint $table) {
            $table->dropColumn([
                'confidence_score', 
                'tags',
                'last_used_at'
            ]);
        });
    }
};
