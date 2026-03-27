<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('collaborative_activities', function (Blueprint $table) {
            $table->id();
            $table->string('space_id', 36);
            $table->unsignedBigInteger('created_by');
            $table->string('activity_type');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('match_type')->nullable();
            $table->decimal('match_score', 3, 2)->nullable()->default(0.00);
            
            // Calendar fields
            $table->timestamp('scheduled_start')->nullable()->index();
            $table->timestamp('scheduled_end')->nullable()->index();
            $table->boolean('is_recurring')->default(false);
            $table->string('recurrence_pattern')->nullable(); // daily, weekly, monthly
            $table->integer('recurrence_interval')->nullable()->default(1); // every X days/weeks/months
            $table->timestamp('recurrence_end')->nullable();
            $table->string('timezone')->default('UTC');
            
            // Duration fields
            $table->integer('duration_minutes')->default(60);
            $table->integer('actual_duration')->nullable();
            
            // Participation
            $table->integer('max_participants')->nullable();
            $table->integer('confirmed_participants')->default(0);
            
            $table->string('status')->default('scheduled')->index(); // scheduled, active, completed, cancelled
            $table->json('metadata')->nullable();
            $table->json('outcomes')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('proposed_at')->useCurrent();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('space_id')->references('id')->on('collaboration_spaces')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');

            $table->index(['space_id', 'scheduled_start', 'status']);
            $table->index(['created_by', 'scheduled_start']);
            $table->index(['scheduled_start', 'status']);
        });

        // Pivot table for activity participants
        Schema::create('collaborative_activity_user', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('collaborative_activity_id');
            $table->unsignedBigInteger('user_id');
            $table->string('role')->default('participant');
            $table->json('contribution')->nullable();
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamp('left_at')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('collaborative_activity_id')->references('id')->on('collaborative_activities')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');

            // Unique constraint
            $table->unique(['collaborative_activity_id', 'user_id'], 'activity_user_unique');
            
            // Indexes
            $table->index('user_id');
            $table->index(['collaborative_activity_id', 'role']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('collaborative_activity_user');
        Schema::dropIfExists('collaborative_activities');
    }
};