<?php

namespace App\Events;

use App\Models\MarketItem;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MarketItemUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $item;

    public function __construct(MarketItem $item)
    {
        $this->item = $item;
    }

    public function broadcastOn()
    {
        return new Channel('market-global');
    }

    public function broadcastAs()
    {
        return 'market-item-updated';
    }

    public function broadcastWith()
    {
        return [
            'item' => $this->item->load(['user', 'media']),
            'itemId' => $this->item->id
        ];
    }
}
