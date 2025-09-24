<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChatbotTrainingNeeded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;
    public $category;
    public $keywords;

    public function __construct(string $message, string $category = 'general', array $keywords = [])
    {
        $this->message = $message;
        $this->category = $category;
        $this->keywords = $keywords;
        
        // REMOVE the automatic notification sending from here
        // Let the controller handle notifications separately
    }

    public function broadcastOn()
    {
        // Broadcast to a channel that private users and admins can subscribe to
        return new Channel('chatbot-training');
    }

    public function broadcastWith()
    {
        return [
            'message' => 'New chatbot training needed',
            'question' => $this->message,
            'category' => $this->category,
            'keywords' => $this->keywords,
            'timestamp' => now()->toISOString(),
            'type' => 'training_needed'
        ];
    }
    
    public function broadcastAs()
    {
        return 'chatbot-training-needed';
    }
}