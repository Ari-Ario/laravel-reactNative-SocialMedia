<?php
// app/Models/MagicEvent.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MagicEvent extends Model
{
    use HasFactory;

    protected $table = 'magic_events';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'space_id',
        'triggered_by',
        'event_type',
        'event_data',
        'context',
        'impact',
        'has_been_discovered',
        'discovery_path',
        'interactions',
    ];

    protected $casts = [
        'event_data' => 'array',
        'context' => 'array',
        'impact' => 'array',
        'discovery_path' => 'array',
        'interactions' => 'array',
        'has_been_discovered' => 'boolean',
    ];

    public function space(): BelongsTo
    {
        return $this->belongsTo(CollaborationSpace::class, 'space_id', 'id');
    }

    public function triggeredByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by');
    }
}