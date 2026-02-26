<?php
// app/Events/WhiteboardElementRemoved.php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WhiteboardElementRemoved implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $elementId;

    public function __construct($space, $elementId)
    {
        $this->space = $space;
        $this->elementId = $elementId;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('presence-space.' . $this->space->id);
    }

    public function broadcastAs()
    {
        return 'whiteboard-element-removed';
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->elementId,
        ];
    }
}
