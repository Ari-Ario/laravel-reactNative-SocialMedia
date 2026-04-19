<?php
// app/Models/PollVote.php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PollVote extends Model
{
    use HasFactory, HasUuids;

    protected static function booted()
    {
        static::created(function ($vote) {
            $spaceId = \Illuminate\Support\Facades\DB::table('polls')
                ->where('id', $vote->poll_id)
                ->value('space_id');
            
            if ($spaceId) {
                \Illuminate\Support\Facades\Cache::increment("space_{$spaceId}_polls_v");
            }
        });
    }

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'poll_id',
        'option_id',
        'user_id',
    ];

    public function poll()
    {
        return $this->belongsTo(Poll::class);
    }

    public function option()
    {
        return $this->belongsTo(PollOption::class , 'option_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}