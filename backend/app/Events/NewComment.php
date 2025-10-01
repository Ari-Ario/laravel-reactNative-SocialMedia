<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewComment implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $comment;
    public $postId;
    public $postOwnerId;

    public function __construct($comment, $postId, $postOwnerId = null)
    {
        $this->comment = $comment;
        $this->postId = $postId;
        // Get post owner ID - you might need to load the post relationship
        $this->postOwnerId = $postOwnerId ?? $comment->post->user_id;
    }

    public function broadcastOn()
    {
        return [
            new Channel('posts.global'),              // For real-time feed updates
            new Channel('user.' . $this->postOwnerId) // For notifications to post owner
        ];
    }

    public function broadcastAs()
    {
        return 'new-comment';
    }

    public function broadcastWith()
    {
        return [
            'comment' => $this->comment->load('user'),
            'postId' => $this->postId,
            'postOwnerId' => $this->postOwnerId,
            // ✅ Add these for easier notification handling
            'type' => 'comment',
            'title' => 'New Comment',
            'message' => $this->comment->user->name . ' commented on your post',
        ];
    }
}