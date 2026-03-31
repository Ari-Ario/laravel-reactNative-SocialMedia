<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

use Illuminate\Notifications\Notification as LaravelNotification;

class NewReaction extends LaravelNotification implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $reaction;
    public $postId;
    public $postOwnerId;

    public function __construct($reaction, $postId, $postOwnerId = null)
    {
        $this->reaction = $reaction;
        $this->postId = $postId;
        $this->postOwnerId = $postOwnerId ?? $reaction->post->user_id;
    }

    public function via($notifiable)
    {
        return ['database', 'broadcast'];
    }

    public function toArray($notifiable)
    {
        return [
            'reaction' => $this->reaction->load('user'),
            'postId' => $this->postId,
            'postOwnerId' => $this->postOwnerId,
            'type' => 'reaction',
            'title' => 'New Reaction',
            'message' => $this->reaction->user->name . ' reacted with ' . $this->reaction->emoji,
        ];
    }

    public function broadcastOn()
    {

        $channels = [
            new Channel('posts-global'), // For real-time feed updates
        ];

        if ($this->postOwnerId != auth()->id()) {
            $channels[] = new PrivateChannel('user-' . $this->postOwnerId); // For notifications to post owner
        }
        return $channels;
    }

    public function broadcastAs()
    {
        return 'new-reaction';
    }

    public function broadcastWith()
    {
        return [
            'reaction' => $this->reaction->load('user'),
            'postId' => $this->postId,
            'postOwnerId' => $this->postOwnerId,
            // ✅ ADD NOTIFICATION METADATA
            'type' => 'reaction',
            'title' => 'New Reaction',
            'message' => $this->reaction->user->name . ' reacted with ' . $this->reaction->emoji,
        ];
    }
}