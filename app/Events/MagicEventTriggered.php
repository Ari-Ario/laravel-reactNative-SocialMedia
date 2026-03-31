<?php

namespace App\Events;

use App\Models\CollaborationSpace;
use App\Models\MagicEvent;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MagicEventTriggered implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $magicEvent;

    /**
     * Create a new event instance.
     */
    public function __construct(CollaborationSpace $space, MagicEvent $magicEvent)
    {
        $this->space = $space;
        $this->magicEvent = $magicEvent;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new PresenceChannel('space-' . $this->space->id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'magic-event-triggered';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'space_id' => $this->space->id,
            'event' => $this->magicEvent,
            'timestamp' => now()->toISOString(),
        ];
    }
}
