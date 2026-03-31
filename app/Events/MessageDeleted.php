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
    public $userIds;

    public function __construct($messageOrId, $spaceId = null, $userIds = [])
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
        $this->userIds = is_array($userIds) ? $userIds : [$userIds];
    }

    public function broadcastOn()
    {
        $channels = [];
        
        if ($this->spaceId) {
            $channels[] = new PresenceChannel('space-' . $this->spaceId);
        }
        else if ($this->message && $this->message->conversation_id) {
            $channels[] = new PresenceChannel('chat-' . $this->message->conversation_id);
        }
        
        foreach ($this->userIds as $userId) {
            if ($userId) {
                $channels[] = new \Illuminate\Broadcasting\Channel('user-' . $userId);
            }
        }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'message-deleted';
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