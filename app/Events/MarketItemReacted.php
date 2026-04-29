<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

use Illuminate\Notifications\Notification as LaravelNotification;

class MarketItemReacted extends LaravelNotification implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $reaction;
    public $itemId;
    public $itemOwnerId;

    public function __construct($reaction, $itemId, $itemOwnerId = null)
    {
        $this->reaction = $reaction;
        $this->itemId = $itemId;
        $this->itemOwnerId = $itemOwnerId ?? $reaction->market_item->user_id;
    }

    public function via($notifiable)
    {
        return ['database', 'broadcast'];
    }

    public function toArray($notifiable)
    {
        return [
            'reaction' => $this->reaction->load('user'),
            'itemId' => $this->itemId,
            'itemOwnerId' => $this->itemOwnerId,
            'type' => 'market_reaction',
            'title' => 'New Reaction on Market Item',
            'message' => $this->reaction->user->name . ' reacted to your item with ' . $this->reaction->emoji,
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
        return 'market-item-reacted';
    }

    public function broadcastWith()
    {
        return [
            'reaction' => $this->reaction->load('user'),
            'itemId' => $this->itemId,
            'itemOwnerId' => $this->itemOwnerId,
            'type' => 'market_reaction',
            'title' => 'New Reaction on Market Item',
            'message' => $this->reaction->user->name . ' reacted to your item with ' . $this->reaction->emoji,
        ];
    }
}
