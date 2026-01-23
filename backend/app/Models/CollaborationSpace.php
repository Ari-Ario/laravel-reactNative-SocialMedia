<?php
// app/Models/CollaborationSpace.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CollaborationSpace extends Model
{
    use HasFactory;

    protected $table = 'collaboration_spaces';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'creator_id',
        'title',
        'description',
        'space_type',
        'settings',
        'content_state',
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
        'linked_conversation_id',
        'linked_post_id',
        'linked_story_id',
    ];

    protected $casts = [
        'settings' => 'array',
        'content_state' => 'array',
        'activity_metrics' => 'array',
        'unlocked_features' => 'array',
        'live_participants' => 'array',
        'emergence_triggers' => 'array',
        'ai_capabilities' => 'array',
        'ai_learning_data' => 'array',
        'is_live' => 'boolean',
        'has_ai_assistant' => 'boolean',
    ];

    // Relationships
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function linkedConversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class, 'linked_conversation_id');
    }

    public function linkedPost(): BelongsTo
    {
        return $this->belongsTo(Post::class, 'linked_post_id');
    }

    public function linkedStory(): BelongsTo
    {
        return $this->belongsTo(Story::class, 'linked_story_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(SpaceParticipation::class, 'space_id', 'id');
    }

    public function participations(): HasMany
    {
        return $this->hasMany(SpaceParticipation::class, 'space_id', 'id');
    }

    public function magicEvents(): HasMany
    {
        return $this->hasMany(MagicEvent::class, 'space_id', 'id');
    }

    public function aiInteractions(): HasMany
    {
        return $this->hasMany(AiInteraction::class, 'space_id', 'id');
    }

    // Scope for user's spaces
    public function scopeForUser($query, $userId)
    {
        return $query->whereHas('participations', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        });
    }
}