<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SpaceArchived implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $spaceId;
    public $userId;
    public $isArchived;

    public function __construct($spaceId, $userId, $isArchived)
    {
        $this->spaceId = $spaceId;
        $this->userId = $userId;
        $this->isArchived = $isArchived;
    }

    public function broadcastOn(): array
    {
        return [
            new \Illuminate\Broadcasting\Channel('user-' . $this->userId),
        ];
    }

    public function broadcastAs()
    {
        return 'space-archived';
    }

    public function broadcastWith()
    {
        return [
            'space_id' => $this->spaceId,
            'is_archived' => $this->isArchived
        ];
    }
}