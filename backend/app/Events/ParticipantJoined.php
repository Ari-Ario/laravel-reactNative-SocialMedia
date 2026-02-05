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

class ParticipantJoined implements ShouldBroadcast
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
        return 'participant.joined';
    }

    public function broadcastWith()
    {
        return [
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'profile_photo' => $this->user->profile_photo,
            ],
            'space_id' => $this->space->id,
            'joined_at' => now()->toISOString(),
        ];
    }
}