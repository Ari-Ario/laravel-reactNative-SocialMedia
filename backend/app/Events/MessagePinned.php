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
    public $userIds;

    public function __construct($messageId, $isPinned, $spaceId, $userIds = [])
    {
        $this->messageId = $messageId;
        $this->isPinned = $isPinned;
        $this->spaceId = $spaceId;
        $this->userIds = is_array($userIds) ? $userIds : [$userIds];
    }

    public function broadcastOn()
    {
        $channels = [];
        
        if ($this->spaceId) {
            $channels[] = new PresenceChannel('space.' . $this->spaceId);
        }
        
        foreach ($this->userIds as $userId) {
            if ($userId) {
                $channels[] = new \Illuminate\Broadcasting\Channel('user.' . $userId);
            }
        }

        return $channels;
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