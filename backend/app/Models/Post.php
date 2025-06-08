<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    use HasFactory;
    
    protected $fillable = [
        'user_id', // Add this line
        'caption',
        // Add any other fields that should be mass assignable
    ];
    protected $with = ['user', 'media', 'reactions', 'comments'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reactions()
    {
        return $this->hasMany(Reaction::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class)->whereNull('parent_id');
    }

    public function media()
    {
        return $this->morphMany(Media::class, 'model');
    }

    public function reactionCounts()
    {
        return $this->reactions()
            ->selectRaw('emoji, count(*) as count')
            ->groupBy('emoji');
    }


    // repost and Bookmark funcs:

    public function reposts()
    {
        return $this->hasMany(Repost::class)->with('user');
    }

    public function bookmarks()
    {
        return $this->hasMany(Bookmark::class);
    }

    public function isRepostedByUser()
    {
        return $this->reposts()->where('user_id', auth()->id())->exists();
    }

    public function isBookmarkedByUser()
    {
        return $this->bookmarks()->where('user_id', auth()->id())->exists();
    }
}