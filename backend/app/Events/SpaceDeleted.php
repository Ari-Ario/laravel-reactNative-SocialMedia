<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SpaceDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $spaceId;
    public $userId;

    public function __construct($spaceId, $userId = null)
    {
        $this->spaceId = $spaceId;
        $this->userId = $userId;
    }

    public function broadcastOn()
    {
        return [
            new Channel('spaces'),
            new PresenceChannel('space.' . $this->spaceId)
        ];
    }

    public function broadcastAs()
    {
        return 'space.deleted';
    }

    public function broadcastWith()
    {
        return [
            'space_id' => $this->spaceId,
            'deleted_by' => $this->userId,
            'update_type' => 'deleted',
            'timestamp' => now()->toISOString()
        ];
    }
}
