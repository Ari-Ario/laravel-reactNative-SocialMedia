<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SpaceMuted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $spaceId;
    public $userId;
    public $isMuted;

    public function __construct($spaceId, $userId, $isMuted)
    {
        $this->spaceId = $spaceId;
        $this->userId = $userId;
        $this->isMuted = $isMuted;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.' . $this->userId),
        ];
    }

    public function broadcastAs()
    {
        return 'space.muted';
    }

    public function broadcastWith()
    {
        return [
            'space_id' => $this->spaceId,
            'is_muted' => $this->isMuted
        ];
    }
}