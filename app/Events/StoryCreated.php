<?php

namespace App\Events;

use App\Models\Story;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StoryCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $story;
    public $followerIds;

    public function __construct(Story $story, array $followerIds = [])
    {
        $this->story = $story->load('user');
        $this->followerIds = $followerIds;
    }

    public function broadcastOn()
    {
        $channels = [];
        foreach ($this->followerIds as $id) {
            $channels[] = new \Illuminate\Broadcasting\PrivateChannel("user-{$id}");
        }
        // Also broadcast to the owner's channel for multi-device sync
        $channels[] = new \Illuminate\Broadcasting\PrivateChannel("user-{$this->story->user_id}");
        
        return $channels;
    }

    public function broadcastAs()
    {
        return 'story-created';
    }

    public function broadcastWith()
    {
        return [
            'story' => $this->story,
            'type' => 'story_created',
            'timestamp' => now()->toIso8601String()
        ];
    }
}
