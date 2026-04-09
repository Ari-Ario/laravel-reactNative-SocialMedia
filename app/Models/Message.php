<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    //
    protected $keyType = 'string';
    public $incrementing = false;

    protected static function booted()
    {
        static::creating(function ($message) {
            $message->id = $message->id ?? (string) \Illuminate\Support\Str::uuid();
        });
    }

    protected $fillable = [
        'id', 'conversation_id', 'user_id', 'content', 'type', 'metadata', 
        'file_path', 'file_size', 'mime_type', 'reactions', 'reply_to_id', 
        'is_edited', 'edited_at', 'is_self_destruct', 'view_timer_seconds', 
        'mood_detected'
    ];

    protected $casts = [
        'metadata' => 'array',
        'reactions' => 'array',
        'is_edited' => 'boolean',
        'is_self_destruct' => 'boolean',
        'edited_at' => 'datetime',
    ];

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function replyTo()
    {
        return $this->belongsTo(Message::class, 'reply_to_id');
    }

    public function replies()
    {
        return $this->hasMany(Message::class, 'reply_to_id');
    }

}
