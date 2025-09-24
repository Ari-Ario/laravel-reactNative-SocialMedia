<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class NewReaction implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $reaction;
    public $postId;

    public function __construct($reaction, $postId)
    {
        $this->reaction = $reaction;
        $this->postId = $postId;
        
        Log::info('🎯 NewReaction Event Created', [
            'post_id' => $postId,
            'reaction_id' => $reaction->id,
            'user_id' => $reaction->user_id
        ]);
    }

    public function broadcastOn()
    {
        Log::info('📡 NewReaction broadcasting on channel', [
            'channel' => 'post.' . $this->postId
        ]);
        
        return new Channel('post.' . $this->postId);
    }
    
    public function broadcastAs()
    {
        return 'new-reaction';
    }
}