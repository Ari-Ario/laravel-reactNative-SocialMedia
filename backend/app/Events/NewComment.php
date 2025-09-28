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

    public function __construct($comment, $postId)
    {
        $this->comment = $comment;
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
            'comment' => [
                'id' => $this->comment->id,
                'content' => $this->comment->content,
                'user_id' => $this->comment->user_id,
                'post_id' => $this->comment->post_id,
                'user' => [
                    'id' => $this->comment->user->id,
                    'name' => $this->comment->user->name,
                    'profile_photo' => $this->comment->user->profile_photo,
                ]
            ],
            'postId' => $this->postId
        ];
    }
    
    public function broadcastAs()
    {
        return 'new-comment';
    }
}