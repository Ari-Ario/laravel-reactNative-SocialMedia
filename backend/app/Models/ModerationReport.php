<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ModerationReport extends Model
{
    protected $fillable = [
        'report_id',
        'reporter_id',
        'target_type',
        'target_id',
        'category',
        'subcategory',
        'description',
        'evidence',
        'severity',
        'status',
        'check_id',
        'reporting_bias_score',
        'action_taken',
        'metadata',
        'resolved_at',
    ];

    protected $casts = [
        'evidence' => 'array',
        'metadata' => 'array',
        'reporting_bias_score' => 'float',
        'resolved_at' => 'datetime',
    ];

    public function reporter()
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function check()
    {
        return $this->belongsTo(ModerationCheck::class, 'check_id');
    }
}
