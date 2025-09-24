<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PostUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $postId;
    public $userId;
    public $userName;
    public $changes;
    public $updatedFields;

    public function __construct($postId, $userId = null, $userName = null, $changes = [], $updatedFields = [])
    {
        $this->postId = $postId;
        $this->userId = $userId;
        $this->userName = $userName;
        $this->changes = $changes;
        $this->updatedFields = $updatedFields;
        
        Log::info('🎯 PostUpdated Event Created', [
            'post_id' => $postId,
            'user_id' => $userId,
            'user_name' => $userName,
            'updated_fields' => $updatedFields
        ]);
    }

    public function broadcastOn()
    {
        Log::info('📡 PostUpdated broadcasting on channel', [
            'channel' => 'post.' . $this->postId
        ]);
        
        return new Channel('post.' . $this->postId);
    }

    public function broadcastWith()
    {
        Log::info('📦 PostUpdated broadcast data prepared', [
            'post_id' => $this->postId
        ]);
        
        return [
            'postId' => $this->postId,
            'userId' => $this->userId,
            'userName' => $this->userName,
            'changes' => $this->changes,
            'updatedFields' => $this->updatedFields,
            'action' => 'updated',
            'timestamp' => now()->toISOString()
        ];
    }
    
    public function broadcastAs()
    {
        return 'post-updated';
    }
}