<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class AIInteraction extends Model
{
    use HasFactory;

    protected $table = 'ai_interactions'; // ✅ FIX

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'space_id',
        'user_id',
        'triggered_by_post_id',
        'interaction_type',
        'user_input',
        'ai_response',
        'training_match_id',
        'context_data',
        'was_helpful',
        'user_feedback',
        'confidence_score',
        'response_time_ms',
    ];

    protected $casts = [
        'context_data' => 'array',
        'user_feedback' => 'array',
        'was_helpful' => 'boolean',
        'confidence_score' => 'float',
    ];
}
