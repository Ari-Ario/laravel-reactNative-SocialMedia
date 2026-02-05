<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Call extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'id',
        'conversation_id',
        'initiator_id',
        'type',
        'status',
        'participants',
        'started_at',
        'ended_at',
        'duration_seconds',
        'call_quality_metrics',
        'recording_path',
        'is_web_compatible',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'participants' => 'array',
        'call_quality_metrics' => 'array',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'is_web_compatible' => 'boolean',
    ];

    /**
     * Indicates if the model's ID is auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = false;

    /**
     * The data type of the auto-incrementing ID.
     *
     * @var string
     */
    protected $keyType = 'string';

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * Get the conversation that owns the call.
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * Get the user who initiated the call.
     */
    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiator_id');
    }

    /**
     * Get the users participating in the call.
     */
    public function users()
    {
        return $this->belongsToMany(User::class, 'call_user', 'call_id', 'user_id')
                    ->withPivot(['joined_at', 'left_at', 'role'])
                    ->withTimestamps();
    }

    /**
     * Scope for active calls.
     */
    public function scopeActive($query)
    {
        return $query->whereIn('status', ['ringing', 'ongoing']);
    }

    /**
     * Scope for completed calls.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Check if call is active.
     */
    public function isActive(): bool
    {
        return in_array($this->status, ['ringing', 'ongoing']);
    }

    /**
     * Check if call is completed.
     */
    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    /**
     * Get the duration of the call in minutes.
     */
    public function getDurationInMinutesAttribute(): float
    {
        if (!$this->started_at || !$this->ended_at) {
            return 0;
        }

        return $this->started_at->diffInMinutes($this->ended_at);
    }

    /**
     * Add participant to call.
     */
    public function addParticipant(User $user, string $role = 'participant'): void
    {
        $this->users()->syncWithoutDetaching([
            $user->id => [
                'joined_at' => now(),
                'role' => $role,
            ]
        ]);

        $participants = $this->participants ?? [];
        if (!in_array($user->id, $participants)) {
            $participants[] = $user->id;
            $this->update(['participants' => $participants]);
        }
    }

    /**
     * Remove participant from call.
     */
    public function removeParticipant(User $user): void
    {
        $this->users()->updateExistingPivot($user->id, ['left_at' => now()]);

        $participants = $this->participants ?? [];
        $participants = array_diff($participants, [$user->id]);
        $this->update(['participants' => $participants]);
    }

    /**
     * Start the call.
     */
    public function start(): void
    {
        $this->update([
            'status' => 'ongoing',
            'started_at' => now(),
        ]);
    }

    /**
     * End the call.
     */
    public function end(): void
    {
        $this->update([
            'status' => 'completed',
            'ended_at' => now(),
            'duration_seconds' => $this->started_at ? $this->started_at->diffInSeconds(now()) : 0,
        ]);
    }

    /**
     * Get the call quality score.
     */
    public function getQualityScoreAttribute(): float
    {
        $metrics = $this->call_quality_metrics ?? [];
        
        if (empty($metrics)) {
            return 0.0;
        }

        $score = 0;
        $count = 0;

        if (isset($metrics['audio_quality'])) {
            $score += $metrics['audio_quality'];
            $count++;
        }

        if (isset($metrics['video_quality'])) {
            $score += $metrics['video_quality'];
            $count++;
        }

        if (isset($metrics['connection_stability'])) {
            $score += $metrics['connection_stability'];
            $count++;
        }

        return $count > 0 ? $score / $count : 0.0;
    }
}