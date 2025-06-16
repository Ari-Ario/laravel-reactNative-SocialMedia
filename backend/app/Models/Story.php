<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Story extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'media_path', 'caption', 'expires_at'];

    protected $dates = ['expires_at'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($story) {
            $story->expires_at = now()->addHours(24);
        });

        static::deleting(function ($story) {
            // Delete the associated media file
            Storage::disk('public')->delete($story->media_path);
        });
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
            $story->delete(); // This will trigger the deleting event
        }

        return $expiredStories->count();
    }

}