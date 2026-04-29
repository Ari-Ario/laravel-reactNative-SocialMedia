<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Notifications\Notification as LaravelNotification;
use Illuminate\Queue\SerializesModels;

class MarketItemCommented extends LaravelNotification implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $comment;
    public $itemId;
    public $itemOwnerId;

    public function __construct($comment, $itemId, $itemOwnerId = null)
    {
        $this->comment = $comment;
        $this->itemId = $itemId;
        $this->itemOwnerId = $itemOwnerId ?? $comment->market_item->user_id;
    }

    public function via($notifiable)
    {
        return ['database', 'broadcast'];
    }

    public function toArray($notifiable)
    {
        return [
            'comment' => $this->comment->load('user'),
            'itemId' => $this->itemId,
            'itemOwnerId' => $this->itemOwnerId,
            'type' => 'market_comment',
            'title' => 'New Comment on Market Item',
            'message' => $this->comment->user->name . ' commented on your item: ' . substr($this->comment->content, 0, 30),
        ];
    }

    public function broadcastOn()
    {
        $channels = [
            new Channel('market-global'),
        ];

        if ($this->itemOwnerId != auth()->id()) {
            $channels[] = new PrivateChannel('user-' . $this->itemOwnerId);
        }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'market-item-commented';
    }

    public function broadcastWith()
    {
        return [
            'comment' => $this->comment->load('user'),
            'itemId' => $this->itemId,
            'itemOwnerId' => $this->itemOwnerId,
            'type' => 'market_comment',
            'title' => 'New Comment on Market Item',
            'message' => $this->comment->user->name . ' commented on your item',
        ];
    }
}
