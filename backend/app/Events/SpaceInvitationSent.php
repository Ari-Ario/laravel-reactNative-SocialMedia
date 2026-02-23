<?php
// app/Events/SpaceInvitationSent.php

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

class SpaceInvitationSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $inviter;
    public $invitedUserId;
    public $message;

    public function __construct(CollaborationSpace $space, User $inviter, $invitedUserId, $message = null)
    {
        $this->space = $space;
        $this->inviter = $inviter;
        $this->invitedUserId = $invitedUserId;
        $this->message = $message;
    }

    public function broadcastOn()
    {
        // Broadcast to the invited user's private channel
        return new PrivateChannel('user.' . $this->invitedUserId);
    }

    public function broadcastAs()
    {
        return 'space.invitation';
    }

    public function broadcastWith()
    {
        return [
            'id' => (string) \Str::uuid(),
            'type' => 'space_invitation',
            'space_id' => $this->space->id,
            'space_title' => $this->space->title,
            'space_type' => $this->space->space_type,
            'inviter_id' => $this->inviter->id,
            'inviter_name' => $this->inviter->name,
            'inviter_avatar' => $this->inviter->profile_photo,
            'message' => $this->message,
            'timestamp' => now()->toISOString(),
        ];
    }
}