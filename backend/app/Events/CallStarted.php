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
use App\Models\Call;
use App\Models\User;

class CallStarted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $call;
    public $user;

    public function __construct(CollaborationSpace $space, Call $call, User $user)
    {
        $this->space = $space;
        $this->call = $call;
        $this->user = $user;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('space.' . $this->space->id);
    }

    public function broadcastAs()
    {
        return 'call.started';
    }

    public function broadcastWith()
    {
        return [
            'call' => [
                'id' => $this->call->id,
                'type' => $this->call->type,
                'status' => $this->call->status,
                'initiator_id' => $this->call->initiator_id,
                'started_at' => $this->call->started_at->toISOString(),
            ],
            'space_id' => $this->space->id,
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ],
        ];
    }
}