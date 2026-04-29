<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MarketItemDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $itemId;

    public function __construct($itemId)
    {
        $this->itemId = $itemId;
    }

    public function broadcastOn()
    {
        return new Channel('market-global');
    }

    public function broadcastAs()
    {
        return 'market-item-deleted';
    }

    public function broadcastWith()
    {
        return [
            'itemId' => $this->itemId
        ];
    }
}
