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

class CallEnded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $call;
    public $user;
    public $toUserId;

    public function __construct(CollaborationSpace $space, Call $call, User $user = null, $toUserId = null)
    {
        $this->space = $space;
        $this->call = $call;
        $this->user = $user ?? auth()->user();
        $this->toUserId = $toUserId;
    }

    public function broadcastOn()
    {
        $channels = [new PresenceChannel('space-' . $this->space->id)];

        if ($this->toUserId) {
            $channels[] = new PrivateChannel('user-' . $this->toUserId);
        }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'call-ended';
    }

    public function broadcastWith()
    {
        return [
            'call' => [
                'id' => $this->call->id,
                'status' => $this->call->status,
                'duration' => $this->call->duration_seconds,
                'ended_at' => now()->toISOString(),
            ],
            'user' => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'profile_photo' => $this->user->profile_photo,
            ] : null,
            'type' => 'call_ended',
            'title' => 'Call Ended',
            'message' => 'The call has ended',
            'profile_photo' => $this->user->profile_photo ?? null,
            'space_id' => $this->space->id,
            'timestamp' => now()->toISOString()
        ];
    }
}