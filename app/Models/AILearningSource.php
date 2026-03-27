<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class AILearningSource extends Model
{
    use HasFactory;

    protected $table = 'ai_learning_sources'; // ✅ FIX

    protected $fillable = [
        'ai_interaction_id',
        'related_post_id',
        'related_comment_id',
        'related_reaction_id',
        'related_story_id',
        'related_conversation_id',
        'related_media_id',
        'extracted_patterns',
        'learned_concepts',
        'added_to_training',
    ];

    protected $casts = [
        'extracted_patterns' => 'array',
        'learned_concepts' => 'array',
        'added_to_training' => 'boolean',
    ];
}
