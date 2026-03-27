<?php
// app/Models/Poll.php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Poll extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'space_id',
        'created_by',
        'question',
        'type',
        'settings',
        'deadline',
        'tags',
        'status',
        'total_votes',
        'unique_voters',
        'forwarded_from',
        'parent_poll_id',
        'closed_at',
        'closed_by',
    ];

    protected $casts = [
        'settings' => 'array',
        'tags' => 'array',
        'forwarded_from' => 'array',
        'deadline' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function space()
    {
        return $this->belongsTo(CollaborationSpace::class , 'space_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class , 'created_by');
    }

    public function options()
    {
        return $this->hasMany(PollOption::class);
    }

    public function votes()
    {
        return $this->hasMany(PollVote::class);
    }

    public function parentPoll()
    {
        return $this->belongsTo(Poll::class , 'parent_poll_id');
    }

    public function childPolls()
    {
        return $this->hasMany(Poll::class , 'parent_poll_id');
    }
}