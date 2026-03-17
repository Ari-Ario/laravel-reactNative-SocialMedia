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
        Schema::table('reposts', function (Blueprint $table) {
            $table->string('context_tag', 50)->nullable()->after('post_id');
            $table->text('personal_note')->nullable()->after('context_tag');
            $table->unsignedBigInteger('collection_id')->nullable()->after('personal_note')->index();
            $table->enum('visibility', ['public', 'followers', 'private'])->default('public')->after('collection_id');
        });

        Schema::create('repost_collections', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->string('cover_image')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('repost_collections');
        
        Schema::table('reposts', function (Blueprint $table) {
            $table->dropColumn(['context_tag', 'personal_note', 'collection_id', 'visibility']);
        });
    }
};
