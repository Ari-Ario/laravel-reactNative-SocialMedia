<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SpacePinned implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $spaceId;
    public $userId;
    public $isPinned;

    public function __construct($spaceId, $userId, $isPinned)
    {
        $this->spaceId = $spaceId;
        $this->userId = $userId;
        $this->isPinned = $isPinned;
    }

    public function broadcastOn(): array
    {
        return [
            new \Illuminate\Broadcasting\Channel('user-' . $this->userId),
        ];
    }

    public function broadcastAs()
    {
        return 'space-pinned';
    }

    public function broadcastWith()
    {
        return [
            'space_id' => $this->spaceId,
            'is_pinned' => $this->isPinned
        ];
    }
}