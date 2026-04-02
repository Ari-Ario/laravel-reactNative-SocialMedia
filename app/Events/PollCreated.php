<?php
// app/Events/PollCreated.php

namespace App\Events;

use App\Models\Poll;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PollCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $pollId;
    public $spaceId;
    public $userIds;

    /**
     * Create a new event instance.
     */
    public function __construct(Poll $poll, $spaceId, $userIds = [])
    {
        $this->pollId = $poll->id;
        $this->spaceId = $spaceId;
        $this->userIds = is_array($userIds) ? $userIds : [$userIds];
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        $channels = [
            new PresenceChannel('space-' . $this->spaceId)
        ];
        
        foreach ($this->userIds as $userId) {
            if ($userId) {
                $channels[] = new \Illuminate\Broadcasting\Channel('user-' . $userId);
            }
        }
        
        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'poll-created';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $poll = Poll::with(['creator', 'options'])
            ->find($this->pollId);

        return [
            'poll' => $poll,
            'user' => [
                'id' => $poll->creator->id ?? null,
                'name' => $poll->creator->name ?? 'Someone',
                'profile_photo' => $poll->creator->profile_photo ?? null,
            ],
            'type' => 'poll_created',
            'title' => 'New Poll',
            'message' => ($poll->creator->name ?? 'Someone') . ' created a new poll: ' . ($poll->question ?? 'New Poll'),
            'profile_photo' => $poll->creator->profile_photo ?? null,
            'space_id' => $this->spaceId,
            'created_at' => now()->toISOString(),
            'timestamp' => now()->toISOString(),
        ];
    }
}