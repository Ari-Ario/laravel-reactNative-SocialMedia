<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExpertDomain extends Model
{
    protected $table = 'expert_domains';

    protected $fillable = [
        'user_id',
        'branch',
        'domain_partition',
        'phase',
    ];

    protected $casts = [
        'phase' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Check if this expert is a superadmin (phase 0 = all branches).
     */
    public function isSuperAdmin(): bool
    {
        return $this->phase === 0;
    }

    /**
     * Get all branches for a given user.
     */
    public static function branchesForUser(int $userId): \Illuminate\Support\Collection
    {
        return static::where('user_id', $userId)->pluck('branch');
    }

    /**
     * Check if a user is a superadmin (has a phase=0 entry).
     */
    public static function userIsSuperAdmin(int $userId): bool
    {
        return static::where('user_id', $userId)->where('phase', 0)->exists();
    }
}
