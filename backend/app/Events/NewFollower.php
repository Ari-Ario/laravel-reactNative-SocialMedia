<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Notifications\Notification as LaravelNotification;
use Illuminate\Queue\SerializesModels;

class NewFollower extends LaravelNotification implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $followerId;
    public $followerName;
    public $followedUserId;

    public function __construct($followerId, $followerName, $followedUserId)
    {
        $this->followerId = $followerId;
        $this->followerName = $followerName;
        $this->followedUserId = $followedUserId;
    }

    public function via($notifiable)
    {
        return ['database', 'broadcast'];
    }

    public function toArray($notifiable)
    {
        return [
            'followerId' => $this->followerId,
            'followerName' => $this->followerName,
            'followedUserId' => $this->followedUserId,
            'type' => 'new_follower',
            'title' => 'New Follower',
            'message' => $this->followerName . ' started following you',
            'timestamp' => now()->toIso8601String(),
        ];
    }

    public function broadcastOn()
    {
        return [
            new Channel('user.' . $this->followedUserId),
        ];
    }

    public function broadcastAs()
    {
        return 'new-follower';
    }

    public function broadcastWith()
    {
        return [
            'followerId' => $this->followerId,
            'followerName' => $this->followerName,
            'followedUserId' => $this->followedUserId,
            'type' => 'new_follower',
            'title' => 'New Follower',
            'message' => $this->followerName . ' started following you',
            'timestamp' => now()->toIso8601String(),
        ];
    }
}