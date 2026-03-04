<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessagePinned implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $messageId;
    public $isPinned;
    public $spaceId;

    public function __construct($messageId, $isPinned, $spaceId)
    {
        $this->messageId = $messageId;
        $this->isPinned = $isPinned;
        $this->spaceId = $spaceId;
    }

    public function broadcastOn()
    {
        if ($this->spaceId) {
            return new PresenceChannel('space.' . $this->spaceId);
        }
        return [];
    }

    public function broadcastAs()
    {
        return 'message.pinned';
    }

    public function broadcastWith()
    {
        return [
            'message_id' => $this->messageId,
            'is_pinned' => $this->isPinned,
            'space_id' => $this->spaceId,
        ];
    }
}