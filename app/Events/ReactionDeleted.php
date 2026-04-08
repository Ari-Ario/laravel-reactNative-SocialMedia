<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Event for reaction deletion for real-time synchronization.
 * It is a simple broadcast event, NOT a notification.
 */
class ReactionDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $postId;
    public $commentId;
    public $userId;

    public function __construct($postId, $userId, $commentId = null)
    {
        $this->postId = $postId;
        $this->userId = $userId;
        $this->commentId = $commentId;
    }

    public function broadcastOn()
    {
        // Broadcast for everyone (real-time sync)
        return [new Channel('posts-global')];
    }

    public function broadcastAs()
    {
        return 'reaction-deleted';
    }

    public function broadcastWith()
    {
        return [
            'postId' => $this->postId,
            'commentId' => $this->commentId,
            'userId' => $this->userId,
            'deleted' => true
        ];
    }
}
