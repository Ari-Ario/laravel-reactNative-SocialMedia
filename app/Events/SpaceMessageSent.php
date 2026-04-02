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
            $channels[] = new PrivateChannel('user-' . $id);
        }
        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs()
    {
        return 'space-message';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith()
    {
        $sender = \App\Models\User::find($this->message['user_id'] ?? 0);
        
        return [
            'chat_message' => $this->message,
            'user' => [
                'id' => $sender->id ?? null,
                'name' => $sender->name ?? 'Someone',
                'profile_photo' => $sender->profile_photo ?? null,
            ],
            'type' => 'space_message',
            'title' => 'New Message',
            'message' => ($sender->name ?? 'Someone') . ': ' . ($this->message['content'] ?? 'Sent a message'),
            'profile_photo' => $sender->profile_photo ?? null,
            'space_id' => $this->spaceId,
            'space' => [
                'id' => $this->spaceId,
                'title' => \App\Models\CollaborationSpace::where('id', $this->spaceId)->value('title'),
            ],
            'timestamp' => now()->toISOString()
        ];
    }
}
