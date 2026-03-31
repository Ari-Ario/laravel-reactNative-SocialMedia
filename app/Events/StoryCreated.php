<?php

namespace App\Events;

use App\Models\Story;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StoryCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $story;

    public function __construct(Story $story)
    {
        $this->story = $story->load('user');
    }

    public function broadcastOn()
    {
        return [new Channel('stories-global')];
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
