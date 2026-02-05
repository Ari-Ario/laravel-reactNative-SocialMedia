<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\CollaborationSpace;

class SpaceUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $userId;
    public $user;

    public function __construct(CollaborationSpace $space, $userId = null)
    {
        $this->space = $space;
        $this->userId = $userId;
    }

    public function broadcastOn()
    {
        return [
            new Channel('spaces'),
            new PrivateChannel('user.' . $this->userId),
            new PresenceChannel('space.' . $this->space->id)
        ];
    }

    public function broadcastAs()
    {
        return 'space.updated';
    }

    public function broadcastWith()
    {
        return [
            'space' => $this->space->load('creator', 'participants.user'),
            'timestamp' => now()->toISOString()
        ];
    }
}