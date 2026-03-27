<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RepostCollection extends Model
{
    protected $fillable = ['user_id', 'name', 'description', 'cover_image'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reposts()
    {
        return $this->hasMany(Repost::class, 'collection_id');
    }
}
