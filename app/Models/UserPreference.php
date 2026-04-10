<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserPreference extends Model
{
    protected $fillable = [
        'user_id',
        'email_notifications',
        'push_notifications',
        'theme',
        'locale',
        'timezone',
        'show_birthday',
        'show_email',
        'show_phone',
        'content_filters',
        'muted_keywords',
        'collaboration_styles',
        'synergy_traits',
        'enable_web_portals',
    ];

    protected $casts = [
        'email_notifications' => 'boolean',
        'push_notifications' => 'boolean',
        'show_birthday' => 'boolean',
        'show_email' => 'boolean',
        'show_phone' => 'boolean',
        'enable_web_portals' => 'boolean',
        'content_filters' => 'array',
        'muted_keywords' => 'array',
        'collaboration_styles' => 'array',
        'synergy_traits' => 'array',
    ];

    /**
     * Get the user that owns the preferences.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
