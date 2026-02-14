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
}
