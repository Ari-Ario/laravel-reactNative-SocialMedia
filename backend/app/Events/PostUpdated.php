<?php

namespace App\Events;

use App\Models\User;
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
    public $followerIds; // ✅ ADD THIS

    public function __construct($postId, $userId = null, $userName = null, $changes = [], $updatedFields = [], $followerIds = [])
    {
        $this->postId = $postId;
        $this->userId = $userId;
        $this->userName = $userName;
        $this->changes = $changes;
        $this->updatedFields = $updatedFields;
        $this->followerIds = $followerIds; // ✅ ADD THIS
        
        Log::info('🎯 PostUpdated Event Created', [
            'post_id' => $postId,
            'user_id' => $userId,
            'user_name' => $userName,
            'updated_fields' => $updatedFields,
            'follower_count' => count($followerIds)
        ]);
    }

    public function broadcastOn()
    {
        // $channels = [new Channel('post.' . $this->postId)]; // For real-time updates
        
        $channels = [
            new Channel('posts.global'), // ✅ Use global channel instead of post.{id}
            // ... keep user channels for notifications
        ];
        
        // Also broadcast to followers for notifications
        foreach ($this->followerIds as $followerId) {
            $channels[] = new Channel('user.' . $followerId);
        }
        
        return $channels;
    }

    public function broadcastWith()
    {
        Log::info('📦 PostUpdated broadcast data prepared', [
            'post_id' => $this->postId
        ]);
        
        return [
            'postId' => $this->postId,
            'userId' => $this->userId,
            'profile_photo' => User::find($this->userId)?->profile_photo, // safe null check
            'userName' => $this->userName,
            'changes' => $this->changes,
            'updatedFields' => $this->updatedFields,
            'followerIds' => $this->followerIds,
            // ✅ ADD NOTIFICATION METADATA
            'type' => 'post_updated',
            'title' => 'Post Updated', 
            'message' => $this->userName . ' updated their post',
            'action' => 'updated',
            'timestamp' => now()->toISOString()
        ];
    }
    
    public function broadcastAs()
    {
        return 'post-updated';
    }
}