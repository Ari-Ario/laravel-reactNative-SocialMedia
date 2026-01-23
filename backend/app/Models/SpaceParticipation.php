<?php
// app/Models/SpaceParticipation.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpaceParticipation extends Model
{
    use HasFactory;

    protected $table = 'space_participations';
    
    protected $fillable = [
        'space_id',
        'user_id',
        'role',
        'permissions',
        'presence_data',
        'contribution_map',
        'focus_areas',
        'cursor_state',
        'audio_video_state',
        'current_activity',
        'reaction_stream',
    ];

    protected $casts = [
        'permissions' => 'array',
        'presence_data' => 'array',
        'contribution_map' => 'array',
        'focus_areas' => 'array',
        'cursor_state' => 'array',
        'audio_video_state' => 'array',
        'reaction_stream' => 'array',
    ];

    // Relationships
    public function space(): BelongsTo
    {
        return $this->belongsTo(CollaborationSpace::class, 'space_id', 'id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}