<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CommentDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $commentId;
    public $postId;
    public $postOwnerId;

    public function __construct($postId, $commentId, $postOwnerId = null)
    {
        $this->commentId = $commentId;
        $this->postId = $postId;
        $this->postOwnerId = $postOwnerId;
    }

    public function broadcastOn()
    {
        $channels = [
            new Channel('posts.global'), // For real-time feed updates
        ];

        if ($this->postOwnerId && $this->postOwnerId != auth()->id()) {
            $channels[] = new Channel('user.' . $this->postOwnerId); // For post owner notifications
        }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'comment-deleted';
    }

    public function broadcastWith()
    {
        return [
            'commentId' => $this->commentId,
            'postId' => $this->postId,
            'deleted' => true
        ];
    }
}