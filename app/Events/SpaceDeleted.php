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
    public $participantIds;

    public function __construct($spaceId, $userId = null, $participantIds = [])
    {
        $this->spaceId = $spaceId;
        $this->userId = $userId;
        $this->participantIds = $participantIds;
    }

    public function broadcastOn()
    {
        $channels = [
            new Channel('spaces')
        ];

        // ✅ Phase 71: Only broadcast to affected participants' private channels
        foreach ($this->participantIds as $participantId) {
            $channels[] = new \Illuminate\Broadcasting\PrivateChannel('user-' . $participantId);
        }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'space-deleted';
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
