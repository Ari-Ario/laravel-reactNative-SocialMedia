<?php

namespace App\Events;

use App\Models\CollaborationSpace;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ScreenShareToggled implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $user;
    public $isSharing;

    /**
     * Create a new event instance.
     */
    public function __construct(CollaborationSpace $space, User $user, bool $isSharing)
    {
        $this->space = $space;
        $this->user = $user;
        $this->isSharing = $isSharing;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new PresenceChannel('space.' . $this->space->id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'screen.share.toggled';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'user_id' => $this->user->id,
            'user_name' => $this->user->name,
            'is_sharing' => $this->isSharing,
            'timestamp' => now()->toISOString(),
        ];
    }
}
