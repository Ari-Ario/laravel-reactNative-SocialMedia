<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SpaceFavorited implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $spaceId;
    public $userId;
    public $isFavorite;

    /**
     * Create a new event instance.
     */
    public function __construct($spaceId, $userId, $isFavorite)
    {
        $this->spaceId = $spaceId;
        $this->userId = $userId;
        $this->isFavorite = $isFavorite;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user-' . $this->userId),
        ];
    }

    /**
     * Get the event name to broadcast as.
     */
    public function broadcastAs()
    {
        return 'space-favorited';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'space_id' => $this->spaceId,
            'is_favorite' => $this->isFavorite,
        ];
    }
}
