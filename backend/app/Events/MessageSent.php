<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $conversation;
    public $message;
    public $user;

    public function __construct(Conversation $conversation, Message $message, User $user)
    {
        $this->conversation = $conversation;
        $this->message = $message;
        $this->user = $user;
    }

    public function broadcastOn()
    {
        return [
            new PresenceChannel('conversation.' . $this->conversation->id),
            new PrivateChannel('user.' . $this->user->id),
        ];
    }

    public function broadcastAs()
    {
        return 'message.sent';
    }

    public function broadcastWith()
    {
        return [
            'message' => [
                'id' => $this->message->id,
                'content' => $this->message->content,
                'type' => $this->message->type,
                'user_id' => $this->message->user_id,
                'user' => $this->message->user,
                'created_at' => $this->message->created_at->toISOString(),
            ],
            'conversation_id' => $this->conversation->id,
            'timestamp' => now()->toISOString(),
        ];
    }
}