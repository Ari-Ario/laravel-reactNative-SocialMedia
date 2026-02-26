<?php
// app/Events/WhiteboardCleared.php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WhiteboardCleared implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $spaceId;

    public function __construct($spaceId)
    {
        $this->spaceId = $spaceId;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('presence-space.' . $this->spaceId);
    }

    public function broadcastAs()
    {
        return 'whiteboard-cleared';
    }

    public function broadcastWith()
    {
        return [
            'spaceId' => $this->spaceId,
        ];
    }
}
