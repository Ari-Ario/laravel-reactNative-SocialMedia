<?php

namespace App\Events;

use App\Models\CollaborativeActivity;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CollaborativeActivityCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $activity;
    public $spaceId;

    /**
     * Create a new event instance.
     */
    public function __construct(CollaborativeActivity $activity)
    {
        $this->activity = $activity->load('creator', 'participants');
        $this->spaceId = $activity->space_id;
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

        // Also broadcast to each participant's private channel to update global counts
        foreach ($this->activity->participants as $participant) {
            $channels[] = new PrivateChannel('user-' . $participant->id);
        }

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs()
    {
        return 'activity-created';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith()
    {
        return [
            'activity' => $this->activity,
            'space_id' => $this->spaceId,
            'timestamp' => now()->toISOString(),
        ];
    }
}
