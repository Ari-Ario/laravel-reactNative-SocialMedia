<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CollaborativeActivityDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $activityId;
    public $spaceId;
    public $participantIds;

    /**
     * Create a new event instance.
     */
    public function __construct($activityId, $spaceId, $participantIds = [])
    {
        $this->activityId = $activityId;
        $this->spaceId = $spaceId;
        $this->participantIds = $participantIds;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn()
    {
        $channels = [
            new PresenceChannel('space-' . $this->spaceId),
        ];

        // Also broadcast to each participant's private channel
        foreach ($this->participantIds as $participantId) {
            $channels[] = new PrivateChannel('user-' . $participantId);
        }

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs()
    {
        return 'activity-deleted';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith()
    {
        return [
            'activity_id' => $this->activityId,
            'space_id' => $this->spaceId,
            'timestamp' => now()->toISOString(),
        ];
    }
}
