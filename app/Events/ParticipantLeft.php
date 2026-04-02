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
        $channels = [new PresenceChannel('space-' . $this->space->id)];

        // Also broadcast to creator's private channel for persistent activity feed
        if ($this->space->creator_id) {
            $channels[] = new PrivateChannel('user-' . $this->space->creator_id);
        }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'participant-left';
    }

    public function broadcastWith()
    {
        return [
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'profile_photo' => $this->user->profile_photo,
            ],
            'type' => 'participant_left',
            'title' => 'Participant Left',
            'message' => "{$this->user->name} left \"{$this->space->title}\"",
            'profile_photo' => $this->user->profile_photo,
            'space_id' => $this->space->id,
            'space_title' => $this->space->title,
            'left_at' => now()->toISOString(),
            'timestamp' => now()->toISOString()
        ];
    }
}