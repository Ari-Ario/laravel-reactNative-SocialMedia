<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StoryDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $storyId;
    public $userId;

    public function __construct($storyId, $userId)
    {
        $this->storyId = $storyId;
        $this->userId = $userId;
    }

    public function broadcastOn()
    {
        return [new Channel('stories.global')];
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
