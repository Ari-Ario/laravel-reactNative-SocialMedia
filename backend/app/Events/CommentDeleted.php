<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CommentDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $commentId;
    public $postId;

    public function __construct($postId ,$commentId)
    {
        $this->commentId = $commentId;
        $this->postId = $postId;
    }

    public function broadcastOn()
    {
        $channels = [
            new Channel('posts.global'), // For real-time feed updates
        ];

        if ($this->postOwnerId != auth()->id()) {
            $channels[] = new Channel('user.' . $this->postOwnerId); // For notifications to post owner
        }

        return $channels;
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