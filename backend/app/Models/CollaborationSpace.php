<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class CollaborationSpace extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'creator_id',
        'space_type',
        'title',
        'description',
        'settings',
        'content_state',
        'linked_conversation_id',
        'linked_post_id',
        'linked_story_id',
        'activity_metrics',
        'evolution_level',
        'unlocked_features',
        'is_live',
        'live_participants',
        'current_focus',
        'emergence_triggers',
        'last_magic_at',
        'has_ai_assistant',
        'ai_personality',
        'ai_capabilities',
        'ai_learning_data',
    ];

    protected $casts = [
        'settings' => 'array',
        'content_state' => 'array',
        'activity_metrics' => 'array',
        'unlocked_features' => 'array',
        'live_participants' => 'array',
        'emergence_triggers' => 'array',
        'ai_capabilities' => 'array',     // ✅ REQUIRED
        'ai_learning_data' => 'array',    // ✅ REQUIRED
        'has_ai_assistant' => 'boolean',
        'is_live' => 'boolean',
    ];
}
