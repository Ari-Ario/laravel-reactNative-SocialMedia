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

    public $commentId;
    public $postId;
    public $postOwnerId;
    public $commenterId;
    public $commenterName;
    public $content;

    public function __construct($commentId, $postId, $postOwnerId, $commenterId, $commenterName, $content)
    {
        $this->commentId = $commentId;
        $this->postId = $postId;
        $this->postOwnerId = $postOwnerId;
        $this->commenterId = $commenterId;
        $this->commenterName = $commenterName;
        $this->content = $content;
    }

    public function via($notifiable)
    {
        return ['database', 'broadcast'];
    }

    public function toArray($notifiable)
    {
        return [
            'commentId' => $this->commentId,
            'postId' => $this->postId,
            'postOwnerId' => $this->postOwnerId,
            'userId' => $this->commenterId,
            'userName' => $this->commenterName,
            'content' => $this->content,
            'type' => 'new_comment',
            'title' => 'New Comment',
            'message' => $this->commenterName . ' commented on your post: ' . substr($this->content, 0, 30),
            'profile_photo' => User::find($this->commenterId)?->profile_photo,
            'timestamp' => now()->toIso8601String(),
        ];
    }

    public function broadcastOn()
    {
        $channels = [new Channel('posts.global')];
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
            'commentId' => $this->commentId,
            'postId' => $this->postId,
            'postOwnerId' => $this->postOwnerId,
            'userId' => $this->commenterId,
            'userName' => $this->commenterName,
            'content' => $this->content,
            'type' => 'new_comment',
            'title' => 'New Comment',
            'message' => $this->commenterName . ' commented on your post',
            'profile_photo' => User::find($this->commenterId)?->profile_photo,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}