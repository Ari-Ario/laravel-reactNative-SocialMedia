<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SpaceMarkedUnread implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $spaceId;
    public $userId;
    public $isUnread;

    public function __construct($spaceId, $userId, $isUnread)
    {
        $this->spaceId = $spaceId;
        $this->userId = $userId;
        $this->isUnread = $isUnread;
    }

    public function broadcastOn(): array
    {
        return [
            new \Illuminate\Broadcasting\Channel('user-' . $this->userId),
        ];
    }

    public function broadcastAs()
    {
        return 'space-unread';
    }

    public function broadcastWith()
    {
        return [
            'space_id' => $this->spaceId,
            'is_unread' => $this->isUnread
        ];
    }
}