<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CommentReaction implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $reaction;
    public $commentId;
    public $postId;
    public $commentOwnerId;

    public function __construct($reaction, $commentId, $postId, $commentOwnerId = null)
    {
        $this->reaction = $reaction;
        $this->commentId = $commentId;
        $this->postId = $postId;
        $this->commentOwnerId = $commentOwnerId ?? $reaction->comment->user_id;
    }

    public function broadcastOn()
    {
        return [
            new Channel('posts.global'),
            new Channel('user.' . $this->commentOwnerId),
        ];
    }

    public function broadcastAs()
    {
        return 'comment-reaction'; // ✅ Use consistent naming
    }

    public function broadcastWith()
    {
        return [
            'reaction' => $this->reaction->load('user'),
            'commentId' => $this->commentId,
            'postId' => $this->postId,
            'commentOwnerId' => $this->commentOwnerId,
            // ✅ ADD NOTIFICATION METADATA
            'type' => 'comment_reaction',
            'title' => 'Comment Reaction',
            'message' => $this->reaction->user->name . ' reacted to your comment',
        ];
    }
}