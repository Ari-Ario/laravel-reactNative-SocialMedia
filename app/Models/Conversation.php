<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    //

    protected $fillable = [
        'name',
        'created_by',
        // add any other fields you insert via ::create()
    ];

    public function participants()
    {
        return $this->belongsToMany(User::class, 'conversation_user');
    }

    public function collaborationSpace()
    {
        return $this->hasOne(CollaborationSpace::class, 'linked_conversation_id');
    }
}
