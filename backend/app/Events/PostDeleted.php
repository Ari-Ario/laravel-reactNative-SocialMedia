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

    public $postId;
    public $followerIds;
    public $userId;
    public $userName;
    public $postCaption;

    public function __construct($postId, $postCation, $followerIds = [], $userId = null, $userName = null)
    {
        $this->postId = $postId;
        $this->postCaption = $postCation;
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
        return 'post-deleted';
    }

    public function broadcastWith()
    {
        return [
            'postId' => $this->postId,
            'postCaption' => $this->postCaption,
            'userId' => $this->userId,
            'profile_photo' => User::find($this->userId)?->profile_photo,
            'userName' => $this->userName,
            'followerIds' => $this->followerIds,
            'type' => 'post_deleted',
            'title' => 'Post Deleted',
            'message' => $this->userName . ' deleted their post',
            'timestamp' => now()->toIso8601String() // Fixed typo: toISOString -> toIso8601String
        ];
    }
}