<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewReaction implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $reaction;
    public $postId;
    public $postOwnerId;

    public function __construct($reaction, $postId, $postOwnerId = null)
    {
        $this->reaction = $reaction;
        $this->postId = $postId;
        $this->postOwnerId = $postOwnerId ?? $reaction->post->user_id;
    }

    public function broadcastOn()
    {
        return [
            new Channel('posts.global'),
            new Channel('user.' . $this->postOwnerId),
        ];
    }

    public function broadcastAs()
    {
        return 'new-reaction';
    }

    public function broadcastWith()
    {
        return [
            'reaction' => $this->reaction->load('user'),
            'postId' => $this->postId,
            'postOwnerId' => $this->postOwnerId,
            // ✅ ADD NOTIFICATION METADATA
            'type' => 'reaction',
            'title' => 'New Reaction',
            'message' => $this->reaction->user->name . ' reacted with ' . $this->reaction->emoji,
        ];
    }
}