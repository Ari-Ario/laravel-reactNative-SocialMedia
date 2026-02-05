<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CollaborativeActivity extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'space_id',
        'created_by',
        'activity_type',
        'title',
        'description',
        'match_type',
        'match_score',
        'suggested_duration',
        'actual_duration',
        'status',
        'metadata',
        'outcomes',
        'notes',
        'proposed_at',
        'started_at',
        'completed_at',
        'cancelled_at',
    ];

    protected $casts = [
        'match_score' => 'decimal:2',
        'metadata' => 'array',
        'outcomes' => 'array',
        'proposed_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    /**
     * Get the space that owns the activity
     */
    public function space(): BelongsTo
    {
        return $this->belongsTo(CollaborationSpace::class, 'space_id', 'id');
    }

    /**
     * Get the user who created the activity
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the participants of the activity
     */
    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'collaborative_activity_user')
            ->withPivot(['role', 'contribution', 'joined_at', 'left_at'])
            ->withTimestamps();
    }

    /**
     * Scope for active activities
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope for proposed activities
     */
    public function scopeProposed($query)
    {
        return $query->where('status', 'proposed');
    }

    /**
     * Scope for completed activities
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Check if user is a participant
     */
    public function isParticipant($userId): bool
    {
        return $this->participants()->where('user_id', $userId)->exists();
    }

    /**
     * Get activity duration (actual or suggested)
     */
    public function getDurationAttribute(): int
    {
        return $this->actual_duration ?? $this->suggested_duration ?? 30;
    }

    /**
     * Get activity progress based on status
     */
    public function getProgressAttribute(): int
    {
        return match($this->status) {
            'proposed' => 0,
            'active' => 50,
            'completed' => 100,
            'cancelled' => 0,
            default => 0,
        };
    }
}