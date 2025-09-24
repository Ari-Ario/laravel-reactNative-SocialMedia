<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class NewPost implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $postId;
    public $userId;
    public $userName;

    public function __construct($postId, $userId = null, $userName = null)
    {
        $this->postId = $postId;
        $this->userId = $userId;
        $this->userName = $userName;
        
        // Log::info('🎯 NewPost Event Created', [
        //     'post_id' => $postId,
        //     'user_id' => $userId,
        //     'user_name' => $userName
        // ]);
    }

    public function broadcastOn()
    {
        // Log::info('📡 NewPost broadcasting on channel', [
        //     'channel' => 'posts'
        // ]);
        
        return new Channel('posts'); // Public channel for all users
    }

    public function broadcastWith()
    {
        // Log::info('📦 NewPost broadcast data prepared', [
        //     'post_id' => $this->postId
        // ]);
        
        return [
            'postId' => $this->postId,
            'userId' => $this->userId,
            'userName' => $this->userName,
            'action' => 'created',
            'timestamp' => now()->toISOString()
        ];
    }
    
    public function broadcastAs()
    {
        return 'new-post';
    }
}