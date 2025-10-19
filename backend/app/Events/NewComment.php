<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Notifications\Notification as LaravelNotification;
use Illuminate\Queue\SerializesModels;

class NewComment extends LaravelNotification implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $comment;
    public $postId;
    public $postOwnerId;

    public function __construct($comment, $postId, $postOwnerId = null)
    {
        $this->comment = $comment;
        $this->postId = $postId;
        $this->postOwnerId = $postOwnerId ?? $comment->post->user_id;
    }

    public function via($notifiable)
    {
        return ['database', 'broadcast'];
    }

    public function toArray($notifiable)
    {
        return [
            'comment' => $this->comment->load('user'),
            'postId' => $this->postId,
            'postOwnerId' => $this->postOwnerId,
            'type' => 'comment',
            'title' => 'New Comment',
            'message' => $this->comment->user->name . ' commented on your post: ' . substr($this->comment->content, 0, 30),
        ];
    }

    public function broadcastOn()
    {
        $channels = [
            new Channel('posts.global'),
        ];

        if ($this->postOwnerId != auth()->id()) {
            $channels[] = new Channel('user.' . $this->postOwnerId);
        }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'new-comment';
    }

    public function broadcastWith()
    {
        return [
            'comment' => $this->comment->load('user'),
            'postId' => $this->postId,
            'postOwnerId' => $this->postOwnerId,
            'type' => 'comment',
            'title' => 'New Comment',
            'message' => $this->comment->user->name . ' commented on your post',
        ];
    }
}