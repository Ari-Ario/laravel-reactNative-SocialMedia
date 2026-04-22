<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StoryDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $storyId;
    public $userId;
    public $followerIds;

    public function __construct($storyId, $userId, array $followerIds = [])
    {
        $this->storyId = $storyId;
        $this->userId = $userId;
        $this->followerIds = $followerIds;
    }

    public function broadcastOn()
    {
        $channels = [];
        foreach ($this->followerIds as $id) {
            $channels[] = new \Illuminate\Broadcasting\PrivateChannel("user-{$id}");
        }
        // Also broadcast to the owner's channel for multi-device sync
        $channels[] = new \Illuminate\Broadcasting\PrivateChannel("user-{$this->userId}");
        
        return $channels;
    }

    public function broadcastAs()
    {
        return 'story-deleted';
    }

    public function broadcastWith()
    {
        return [
            'storyId' => $this->storyId,
            'userId' => $this->userId,
            'type' => 'story_deleted',
            'timestamp' => now()->toIso8601String()
        ];
    }
}
