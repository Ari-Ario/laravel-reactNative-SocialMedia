<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ModerationCheck extends Model
{
    use HasUuids;

    protected $fillable = [
        'target_type',
        'target_id',
        'content_snapshot',
        'fact_score',
        'morality_score',
        'bias_score',
        'malicious_intent_score',
        'ai_flags',
        'recommended_action',
    ];

    protected $casts = [
        'ai_flags' => 'array',
        'fact_score' => 'float',
        'morality_score' => 'float',
        'bias_score' => 'float',
        'malicious_intent_score' => 'float',
    ];

    public function reports()
    {
        return $this->hasMany(ModerationReport::class, 'check_id');
    }
}
