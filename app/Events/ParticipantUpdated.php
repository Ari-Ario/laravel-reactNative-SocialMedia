<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\CollaborationSpace;
use App\Models\User;

class ParticipantUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $user;
    public $newRole;

    public function __construct(CollaborationSpace $space, User $user, string $newRole)
    {
        $this->space = $space;
        $this->user = $user;
        $this->newRole = $newRole;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('space.' . $this->space->id);
    }

    public function broadcastAs()
    {
        return 'participant.updated';
    }

    public function broadcastWith()
    {
        return [
            'user_id' => $this->user->id,
            'user_name' => $this->user->name,
            'role' => $this->newRole,
            'timestamp' => now()->toISOString(),
        ];
    }
}