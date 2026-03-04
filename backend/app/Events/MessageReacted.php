<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageReacted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;
    public $user;
    public $reaction;
    public $spaceId;

    public function __construct($message, $user, $reaction, $spaceId = null)
    {
        $this->message = clone (object)$message;

        // Remove sensitive recursive relations if any
        unset($this->message->space);

        $this->user = clone (object)$user;
        $this->reaction = $reaction;
        $this->spaceId = $spaceId;
    }

    public function broadcastOn()
    {
        if ($this->spaceId) {
            return new PresenceChannel('space.' . $this->spaceId);
        }
        else if (isset($this->message->conversation_id)) {
            return new PresenceChannel('chat.' . $this->message->conversation_id);
        }

        return [];
    }

    public function broadcastAs()
    {
        return 'message.reacted';
    }

    public function broadcastWith()
    {
        return [
            'id' => is_array($this->message) ? ($this->message['id'] ?? null) : ($this->message->id ?? null),
            'message' => $this->message,
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'profile_photo' => $this->user->profile_photo,
            ],
            'reaction' => $this->reaction,
            'space_id' => $this->spaceId,
        ];
    }
}