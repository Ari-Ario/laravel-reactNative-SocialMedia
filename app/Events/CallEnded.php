<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\CollaborationSpace;
use App\Models\Call;

class CallEnded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $call;

    public function __construct(CollaborationSpace $space, Call $call)
    {
        $this->space = $space;
        $this->call = $call;
    }

    public function broadcastOn()
    {
        return [
            new PresenceChannel('space.' . $this->space->id),
        ];
    }

    public function broadcastAs()
    {
        return 'call.ended';
    }

    public function broadcastWith()
    {
        return [
            'call_id' => $this->call->id,
            'space_id' => $this->space->id,
            'duration' => $this->call->duration_seconds,
            'ended_at' => now()->toISOString(),
        ];
    }
}