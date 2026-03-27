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
use App\Models\User;

class ParticipantLeft implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $user;

    public function __construct(CollaborationSpace $space, User $user)
    {
        $this->space = $space;
        $this->user = $user;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('space.' . $this->space->id);
    }

    public function broadcastAs()
    {
        return 'participant.left';
    }

    public function broadcastWith()
    {
        return [
            'user_id' => $this->user->id,
            'space_id' => $this->space->id,
            'left_at' => now()->toISOString(),
        ];
    }
}