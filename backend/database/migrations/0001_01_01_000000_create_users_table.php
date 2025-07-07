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
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('username')->unique(); // For @mentions
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');

            // Profile information
            $table->text('bio')->nullable();
            $table->date('birthday')->nullable();
            $table->string('gender')->nullable();
            $table->string('profile_photo')->nullable();
            $table->string('cover_photo')->nullable();


            // Professional information
            $table->string('job_title')->nullable();
            $table->string('company')->nullable();
            $table->text('education')->nullable();

            // Contact
            $table->string('website')->nullable();
            $table->string('location')->nullable();
            $table->string('phone')->nullable();

            // Social links (consider JSON if many platforms)
            $table->string('X')->nullable();
            $table->string('telegram')->nullable();
            $table->string('instagram')->nullable();
            $table->string('facebook')->nullable();
            
            // Privacy and preferences
            $table->boolean('is_private')->default(false);
            $table->boolean('is_admin')->default(false);
            
            // Stats (can be updated asynchronously)
            $table->unsignedInteger('follower_count')->default(0);
            $table->unsignedInteger('following_count')->default(0);
            $table->unsignedInteger('post_count')->default(0);
            
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes(); // For account deletion
        });

        Schema::create('user_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            
            // Notification preferences
            $table->boolean('email_notifications')->default(true);
            $table->boolean('push_notifications')->default(true);
            
            // Display preferences
            $table->string('theme')->default('light');
            $table->string('locale', 10)->default('en');
            $table->string('timezone')->nullable();
            
            // Privacy preferences
            $table->boolean('show_birthday')->default(false);
            $table->boolean('show_email')->default(false);
            $table->boolean('show_phone')->default(false);
            
            // Content preferences
            $table->json('content_filters')->nullable();
            $table->json('muted_keywords')->nullable();
            
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
