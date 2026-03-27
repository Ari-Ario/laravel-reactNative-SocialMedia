<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SpaceMessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $spaceId;
    public $userIds; // Changed from userId to userIds
    public $message;

    /**
     * Create a new event instance.
     * @param string $spaceId
     * @param array|int|string $userIds One or more user IDs to broadcast to
     * @param array $message
     */
    public function __construct($spaceId, $userIds, $message)
    {
        $this->spaceId = $spaceId;
        // Ensure it's always an array
        $this->userIds = is_array($userIds) ? $userIds : [$userIds];
        $this->message = $message;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        $channels = [];
        foreach ($this->userIds as $id) {
            $channels[] = new PrivateChannel('user.' . $id);
        }
        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs()
    {
        return 'space.message';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith()
    {
        return [
            'space_id' => $this->spaceId,
            'message' => $this->message,
            'space' => [
                'id' => $this->spaceId,
                'creator_id' => \App\Models\CollaborationSpace::where('id', $this->spaceId)->value('creator_id'),
                'title' => \App\Models\CollaborationSpace::where('id', $this->spaceId)->value('title'),
                'space_type' => \App\Models\CollaborationSpace::where('id', $this->spaceId)->value('space_type'),
                // drastically reduce payload size to avoid Pusher 10KB crash limits on heavily populated active spaces!
                'participations' => \App\Models\CollaborationSpace::where('id', $this->spaceId)->value('space_type') === 'direct' 
                    ? \App\Models\SpaceParticipation::where('space_id', $this->spaceId)->with('user:id,name,username,profile_photo')->get() 
                    : [],
            ],
            'timestamp' => now()->toISOString(),
        ];
    }
}
