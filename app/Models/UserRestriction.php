<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserRestriction extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'reason',
        'duration_hours',
        'expires_at',
        'moderator_id',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function moderator()
    {
        return $this->belongsTo(User::class, 'moderator_id');
    }

    public function scopeActive($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('expires_at')
              ->orWhere('expires_at', '>', now());
        });
    }
}
