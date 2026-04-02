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
    public $role;

    public function __construct(CollaborationSpace $space, User $user, $role = 'participant')
    {
        $this->space = $space;
        $this->user = $user;
        $this->role = $role;
    }

    public function broadcastOn()
    {
        $channels = [new PresenceChannel('space-' . $this->space->id)];
        
        // Also broadcast to caller's private channel (if needed, but usually the members)
        // Here we'll target the creator specifically so they get the persistent notification
        if ($this->space->creator_id) {
            $channels[] = new PrivateChannel('user-' . $this->space->creator_id);
        }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'participant-joined';
    }

    public function broadcastWith()
    {
        return [
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'profile_photo' => $this->user->profile_photo,
                'role' => $this->role,
            ],
            'type' => 'participant_joined',
            'title' => 'New Participant',
            'message' => "{$this->user->name} joined \"{$this->space->title}\"",
            'profile_photo' => $this->user->profile_photo,
            'space_id' => $this->space->id,
            'space_title' => $this->space->title,
            'joined_at' => now()->toISOString(),
            'timestamp' => now()->toISOString()
        ];
    }
}