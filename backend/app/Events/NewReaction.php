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

    public function __construct($reaction, $postId)
    {
        $this->reaction = $reaction;
        $this->postId = $postId;
    }

    public function broadcastOn()
    {
        return new Channel('post.' . $this->postId);
    }

    public function broadcastWith()
    {
        // CRITICAL: Return a proper array structure
        return [
            'reaction' => [
                'id' => $this->reaction->id,
                'emoji' => $this->reaction->emoji,
                'user_id' => $this->reaction->user_id,
                'post_id' => $this->reaction->post_id,
                'user' => [
                    'id' => $this->reaction->user->id,
                    'name' => $this->reaction->user->name,
                    'profile_photo' => $this->reaction->user->profile_photo,
                ]
            ],
            'postId' => $this->postId
        ];
    }
    
    public function broadcastAs()
    {
        return 'new-reaction';
    }
}