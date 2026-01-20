<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class MagicEvent extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

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
        'event_data' => 'array',        // ✅ REQUIRED
        'context' => 'array',
        'impact' => 'array',
        'discovery_path' => 'array',
        'interactions' => 'array',
        'has_been_discovered' => 'boolean',
    ];
}
