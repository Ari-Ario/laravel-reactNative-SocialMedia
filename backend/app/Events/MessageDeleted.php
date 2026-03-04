<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\Message;

class MessageDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;
    public $messageId;
    public $spaceId;

    public function __construct($messageOrId, $spaceId = null)
    {
        if ($messageOrId instanceof Message) {
            $this->message = clone $messageOrId;
            $this->messageId = $messageOrId->id;
            $this->spaceId = $messageOrId->space_id;
        }
        else {
            $this->messageId = $messageOrId;
            $this->spaceId = $spaceId;
        }
    }

    public function broadcastOn()
    {
        if ($this->spaceId) {
            return new PresenceChannel('space.' . $this->spaceId);
        }
        else if ($this->message && $this->message->conversation_id) {
            return new PresenceChannel('chat.' . $this->message->conversation_id);
        }

        return [];
    }

    public function broadcastAs()
    {
        return 'message.deleted';
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->messageId,
            'conversation_id' => $this->message ? $this->message->conversation_id : null,
            'space_id' => $this->spaceId,
        ];
    }
}