<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewFollower implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $follower;
    public $followedUserId;

    public function __construct($follower, $followedUserId)
    {
        $this->follower = $follower;
        $this->followedUserId = $followedUserId;
    }

    public function broadcastOn()
    {
        return [
            new Channel('user.' . $this->followedUserId),
        ];
    }

    public function broadcastAs()
    {
        return 'new-follower'; // ✅ Use consistent naming
    }

    public function broadcastWith()
    {
        return [
            'follower' => $this->follower,
            'followedUserId' => $this->followedUserId,
            // ✅ ADD NOTIFICATION METADATA
            'type' => 'new_follower',
            'title' => 'New Follower',
            'message' => $this->follower->name . ' started following you',
        ];
    }
}