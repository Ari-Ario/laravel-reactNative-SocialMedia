<?php
// app/Events/WhiteboardElementAdded.php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WhiteboardElementAdded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $element;

    public function __construct($space, $element)
    {
        $this->space = $space;
        $this->element = $element;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('presence-space.' . $this->space->id);
    }

    public function broadcastAs()
    {
        return 'whiteboard-element-added';
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->element->id,
            'type' => $this->element->type,
            'userId' => $this->element->user_id,
            'data' => $this->element->data,
            'version' => $this->element->version,
            'createdAt' => $this->element->created_at,
        ];
    }
}

// Create similar files for:
// WhiteboardElementUpdated.php
// WhiteboardElementRemoved.php
// WhiteboardCleared.php
// WhiteboardCursorMoved.php