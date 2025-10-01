<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewPost implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $post;
    public $followerIds; // Array of follower IDs

    public function __construct($post, $followerIds = [])
    {
        $this->post = $post;
        $this->followerIds = $followerIds;
    }

    public function broadcastOn()
    {
        $channels = [new Channel('posts.global')];
        
        // Broadcast to all followers
        foreach ($this->followerIds as $followerId) {
            $channels[] = new Channel('user.' . $followerId);
        }
        
        return $channels;
    }

    public function broadcastAs()
    {
        return 'new-post';
    }

    public function broadcastWith()
    {
        return [
            'post' => $this->post->load('user'),
            'followerIds' => $this->followerIds,
            // ✅ ADD NOTIFICATION METADATA
            'type' => 'new_post',
            'title' => 'New Post',
            'message' => $this->post->user->name . ' created a new post',
        ];
    }
}