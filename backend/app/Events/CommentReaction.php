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
        $channels = [
            new Channel('posts.global'), // For real-time feed updates
        ];
        
        // ✅ FIX: Always broadcast to posts.global for real-time updates
        // Only send notifications if it's not the comment owner reacting
        if ($this->commentOwnerId != auth()->id()) {
            $channels[] = new Channel('user.' . $this->commentOwnerId); // For notifications
        }
        
        return $channels;  
    }

    public function broadcastAs()
    {
        return 'comment-reaction'; // ✅ Matches frontend
    }

    public function broadcastWith()
    {
        return [
            'reaction' => $this->reaction->load('user'),
            'commentId' => $this->commentId,
            'postId' => $this->postId,
            'commentOwnerId' => $this->commentOwnerId,
            // ✅ FIX: Use consistent data structure
            'type' => 'comment_reaction',
            'title' => 'Comment Reaction',
            'message' => $this->reaction->user->name . ' reacted to your comment',
            'timestamp' => now()->toISOString()
        ];
    }
}