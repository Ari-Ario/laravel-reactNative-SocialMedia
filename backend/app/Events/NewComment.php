<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class NewComment implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $comment;
    public $postId;

    public function __construct($comment, $postId)
    {
        $this->comment = $comment;
        $this->postId = $postId;
        
        Log::info('🎯 NewComment Event Created', [
            'post_id' => $postId,
            'comment_id' => $comment->id,
            'user_id' => $comment->user_id
        ]);
    }

    public function broadcastOn()
    {
        Log::info('📡 NewComment broadcasting on channel', [
            'channel' => 'post.' . $this->postId
        ]);
        
        return new Channel('post.' . $this->postId);
    }

    public function broadcastWith()
    {
        Log::info('📦 NewComment broadcast data prepared', [
            'post_id' => $this->postId,
            'comment_id' => $this->comment->id
        ]);
        
        return [
            'comment' => $this->comment->load('user'),
            'postId' => $this->postId
        ];
    }
    
    public function broadcastAs()
    {
        return 'new-comment';
    }
}