<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UserActivityUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $userId;
    public $activity;
    public $data;

    public function __construct($userId, $activity, $data = [])
    {
        $this->userId = $userId;
        $this->activity = $activity;
        $this->data = $data;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('user.' . $this->userId);
    }

    public function broadcastAs()
    {
        return 'user.activity';
    }

    public function broadcastWith()
    {
        return [
            'activity' => $this->activity,
            'data' => $this->data,
            'timestamp' => now()->toISOString()
        ];
    }
}