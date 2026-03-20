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
        // 1. Moderation Checks (System-initiated AI validation)
        Schema::create('moderation_checks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('target_type'); // post, user, comment, space, story
            $table->unsignedBigInteger('target_id');
            $table->text('content_snapshot')->nullable(); // Text analyzed
            
            // AI Scores (0.00 to 1.00)
            $table->decimal('fact_score', 5, 4)->default(1.0000); // Scientific/Factual accuracy
            $table->decimal('morality_score', 5, 4)->default(1.0000); // Alignment with ethical standards
            $table->decimal('bias_score', 5, 4)->default(0.0000); // Detected reporting/content bias
            $table->decimal('malicious_intent_score', 5, 4)->default(0.0000); // Insult, hate speech, etc.
            
            $table->json('ai_flags')->nullable(); // ['medical_context', 'ethnic_expression', 'insult']
            $table->string('recommended_action')->default('none'); // 'none', 'flag', 'hide', 'restrict'
            
            $table->timestamps();
            $table->index(['target_type', 'target_id']);
        });

        // 2. Moderation Reports (User-initiated reports with AI cross-referencing)
        Schema::create('moderation_reports', function (Blueprint $table) {
            $table->id();
            $table->string('report_id')->unique(); // e.g., REP-ABCD-1234
            $table->foreignId('reporter_id')->nullable()->constrained('users')->onDelete('set null');
            
            $table->string('target_type');
            $table->unsignedBigInteger('target_id');
            
            $table->string('category'); // misinformation, harassment, intellectual_property, etc.
            $table->string('subcategory')->nullable();
            
            $table->text('description')->nullable();
            $table->json('evidence')->nullable(); // List of URLs/Paths
            
            $table->enum('severity', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->enum('status', ['pending', 'reviewing', 'resolved', 'dismissed'])->default('pending');
            
            // AI Cross-reference
            $table->foreignUuid('check_id')->nullable()->constrained('moderation_checks')->onDelete('set null');
            $table->decimal('reporting_bias_score', 5, 4)->default(0.0000); // AI's suspicion of false reporting
            
            $table->string('action_taken')->nullable();
            $table->json('metadata')->nullable();
            
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            
            $table->index(['target_type', 'target_id']);
            $table->index('status');
        });

        // 3. User Compliance & Reputation
        Schema::create('user_compliance_tracks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            $table->decimal('trust_score', 5, 4)->default(1.0000); // Decreases with violations
            $table->decimal('reporting_integrity', 5, 4)->default(1.0000); // Decreases with false reports
            
            $table->integer('violation_count')->default(0);
            $table->integer('false_report_count')->default(0);
            
            $table->json('protected_status')->nullable(); // ['ethnic_minority', 'verified_expert']
            
            $table->timestamps();
        });

        // 4. User Restrictions (Automated actions)
        Schema::create('user_restrictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('type', ['warning', 'shadowban', 'suspension', 'ban'])->default('warning');
            
            $table->text('reason');
            $table->integer('duration_hours')->nullable();
            $table->timestamp('expires_at')->nullable();
            
            $table->foreignId('moderator_id')->nullable()->constrained('users')->onDelete('set null'); // System or human
            $table->timestamps();
            
            $table->index(['user_id', 'expires_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_restrictions');
        Schema::dropIfExists('user_compliance_tracks');
        Schema::dropIfExists('moderation_reports');
        Schema::dropIfExists('moderation_checks');
    }
};
