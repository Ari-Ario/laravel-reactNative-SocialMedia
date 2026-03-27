<?php
// app/Events/PollUpdated.php

namespace App\Events;

use App\Models\Poll;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PollUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $pollId;
    public $spaceId;
    public $userId;

    /**
     * Create a new event instance.
     */
    public function __construct(Poll $poll, $spaceId, $userId)
    {
        // Store only the ID, not the whole model with relationships
        $this->pollId = $poll->id;
        $this->spaceId = $spaceId;
        $this->userId = $userId;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PresenceChannel('space.' . $this->spaceId),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'poll.updated';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        // Load the poll with relationships for broadcasting
        $poll = Poll::with(['creator', 'options.votes.user'])
            ->find($this->pollId);

        return [
            'poll' => $poll,
            'space_id' => $this->spaceId,
            'user_id' => $this->userId,
            'updated_at' => now()->toISOString(),
        ];
    }
}