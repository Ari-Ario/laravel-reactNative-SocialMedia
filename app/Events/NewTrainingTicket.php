<?php

namespace App\Events;

use App\Models\ChatbotTraining;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired when the chatbot engine fails to resolve a thesis and auto-creates
 * a training ticket. Only expert users receive this broadcast.
 */
class NewTrainingTicket implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly ChatbotTraining $training) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('experts')];
    }

    public function broadcastAs(): string
    {
        return 'training.ticket.new';
    }

    public function broadcastWith(): array
    {
        return [
            'ticket_id'  => $this->training->id,
            'trigger'    => mb_substr($this->training->trigger, 0, 120),
            'branch'     => $this->training->branch,
            'category'   => $this->training->category,
            'created_at' => $this->training->created_at,
        ];
    }
}
