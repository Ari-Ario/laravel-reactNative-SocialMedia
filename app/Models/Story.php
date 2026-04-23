<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Story extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 
        'media_path', 
        'caption', 
        'location', 
        'stickers', 
        'type',
        'expires_at'
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'location' => 'array',
        'stickers' => 'array',
    ];

    protected $appends = ['views_count'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($story) {
            if (!$story->expires_at) {
                $story->expires_at = now()->addHours(24);
            }
        });

        static::saved(fn () => \Illuminate\Support\Facades\Cache::put('stories_global_version', time(), 86400));
        
        static::deleting(function ($story) {
            // Delete the associated media file
            if ($story->media_path) {
                Storage::disk('public')->delete($story->media_path);
            }
        });

        static::deleted(fn () => \Illuminate\Support\Facades\Cache::put('stories_global_version', time(), 86400));
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function viewers()
    {
        return $this->belongsToMany(User::class, 'story_views')
            ->withTimestamps();
    }

    public static function cleanupExpiredStories()
    {
        $expiredStories = self::where('expires_at', '<=', now())->get();

        foreach ($expiredStories as $story) {
            /** @var Story $story */
            $story->delete(); // This will trigger the deleting event
        }

        return $expiredStories->count();
    }


    public function getViewsCountAttribute()
    {
        return $this->viewers_count ?? $this->viewers()->count();
    }
}
