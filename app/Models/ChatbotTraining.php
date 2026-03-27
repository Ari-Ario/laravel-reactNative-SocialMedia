<?php

// app/Models/ChatbotTraining.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\User;

class ChatbotTraining extends Model
{
    use SoftDeletes;
    protected $table = 'chatbot_training';

    protected $fillable = [
        'trigger',
        'response',
        'context',
        'keywords',
        'category',
        'needs_review',
        'is_active',
        'trained_by'
    ];

    protected $casts = [
        'keywords' => 'array',
        'needs_review' => 'boolean',
        'is_active' => 'boolean'
    ];

    public function trainer()
    {
        return $this->belongsTo(User::class, 'trained_by');
    }
}
