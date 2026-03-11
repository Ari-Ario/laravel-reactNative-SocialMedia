<?php
// app/Events/PollDeleted.php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PollDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $pollId;
    public $spaceId;
    public $userIds;

    public function __construct($pollId, $spaceId, $userIds = [])
    {
        $this->pollId = $pollId;
        $this->spaceId = $spaceId;
        $this->userIds = is_array($userIds) ? $userIds : [$userIds];
    }

    public function broadcastOn()
    {
        $channels = [
            new PresenceChannel('space.' . $this->spaceId)
        ];
        
        foreach ($this->userIds as $userId) {
            if ($userId) {
                $channels[] = new \Illuminate\Broadcasting\Channel('user.' . $userId);
            }
        }
        
        return $channels;
    }

    public function broadcastAs()
    {
        return 'poll.deleted';
    }

    public function broadcastWith()
    {
        return [
            'poll_id' => $this->pollId,
            'space_id' => $this->spaceId,
            'deleted_at' => now()->toISOString(),
        ];
    }
}