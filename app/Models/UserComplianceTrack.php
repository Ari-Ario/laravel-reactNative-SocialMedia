<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserComplianceTrack extends Model
{
    protected $fillable = [
        'user_id',
        'trust_score',
        'reporting_integrity',
        'violation_count',
        'false_report_count',
        'protected_status',
    ];

    protected $casts = [
        'trust_score' => 'float',
        'reporting_integrity' => 'float',
        'protected_status' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
