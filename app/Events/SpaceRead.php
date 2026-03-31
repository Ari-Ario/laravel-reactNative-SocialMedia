<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SpaceRead implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $spaceId;
    public $userId;
    public $lastReadAt;

    public function __construct($spaceId, $userId, $lastReadAt)
    {
        $this->spaceId = $spaceId;
        $this->userId = $userId;
        $this->lastReadAt = $lastReadAt;
    }

    public function broadcastOn(): array
    {
        return [
            new \Illuminate\Broadcasting\Channel('user-' . $this->userId),
        ];
    }

    public function broadcastAs()
    {
        return 'space-read';
    }

    public function broadcastWith()
    {
        return [
            'space_id' => $this->spaceId,
            'last_read_at' => $this->lastReadAt
        ];
    }
}
