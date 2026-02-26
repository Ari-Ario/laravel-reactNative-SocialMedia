<?php
// app/Events/WhiteboardCursorMoved.php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WhiteboardCursorMoved implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $spaceId;
    public $userId;
    public $x;
    public $y;
    public $userName;

    public function __construct($spaceId, $userId, $x, $y, $userName)
    {
        $this->spaceId = $spaceId;
        $this->userId = $userId;
        $this->x = $x;
        $this->y = $y;
        $this->userName = $userName;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('presence-space.' . $this->spaceId);
    }

    public function broadcastAs()
    {
        return 'whiteboard-cursor-moved';
    }

    public function broadcastWith()
    {
        return [
            'userId' => $this->userId,
            'userName' => $this->userName,
            'x' => $this->x,
            'y' => $this->y,
        ];
    }
}
