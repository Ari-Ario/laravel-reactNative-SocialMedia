<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PostDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $postId; // ✅ FIX: Use postId instead of postToDelete for consistency
    public $followerIds;
    public $userId;
    public $userName;

    public function __construct($postId, $followerIds = [], $userId = null, $userName = null)
    {
        $this->postId = $postId; // ✅ FIX: Use postId for consistency
        $this->followerIds = $followerIds;
        $this->userId = $userId;
        $this->userName = $userName;
    }

    public function broadcastOn()
    {
        $channels = [
            new Channel('posts.global'), // For real-time feed updates
        ];

        // Broadcast to followers for notifications
        foreach ($this->followerIds as $followerId) {
            $channels[] = new Channel('user.' . $followerId);
        }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'post-deleted'; // ✅ Matches frontend
    }

    public function broadcastWith()
    {
        return [
            'postId' => $this->postId, // ✅ FIX: Use postId for consistency
            'userId' => $this->userId,
            'profile_photo' => User::find($this->userId)?->profile_photo,
            'userName' => $this->userName,
            'followerIds' => $this->followerIds,
            // ✅ FIX: Use consistent data structure
            'type' => 'post_deleted',
            'title' => 'Post Deleted', 
            'message' => $this->userName . ' deleted their post',
            'timestamp' => now()->toISOString()
        ];
    }
}