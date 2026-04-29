<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarketItem extends Model
{
    use \Illuminate\Database\Eloquent\SoftDeletes;

    protected $fillable = [
        'user_id',
        'title',
        'description',
        'price',
        'currency',
        'condition',
        'category',
        'status',
        'delivery_available',
        'location',
        'ai_metadata',
        'views'
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'delivery_available' => 'boolean',
        'location' => 'array',
        'ai_metadata' => 'array',
    ];

    /**
     * Get the user that owns the market item.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get all of the item's media.
     */
    public function media()
    {
        return $this->morphMany(Media::class, 'model');
    }

    public function comments()
    {
        return $this->hasMany(Comment::class)->whereNull('parent_id');
    }

    public function reactions()
    {
        return $this->hasMany(Reaction::class);
    }

    public function reactionCounts()
    {
        return $this->reactions()
            ->selectRaw('market_item_id, emoji, count(*) as count')
            ->groupBy('market_item_id', 'emoji');
    }

    public function reposts()
    {
        return $this->hasMany(Repost::class)->with('user');
    }

    public function bookmarks()
    {
        return $this->hasMany(Bookmark::class);
    }
}
