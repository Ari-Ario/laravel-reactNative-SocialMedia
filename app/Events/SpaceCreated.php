<?php
// app/Events/SpaceCreated.php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\CollaborationSpace;
use App\Models\User;

class SpaceCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $creator;
    public $followerIds;

    public function __construct(CollaborationSpace $space, User $creator)
    {
        $this->space = $space->load('creator');
        $this->creator = $creator;
        $this->followerIds = $creator->followers()->pluck('users.id')->toArray();
    }

    public function broadcastOn()
    {
        // ✅ Phase 71: Restrict Creation Notifications to 'general' and 'channel' spaces for followers
        if (!in_array($this->space->space_type, ['general', 'channel'])) {
            return [];
        }

        $channels = [];
        
        // Send to each follower's private channel (Phase 71: Use PrivateChannel)
        foreach ($this->followerIds as $followerId) {
            $channels[] = new PrivateChannel('user.' . $followerId);
        }
        
        return $channels;
    }

    public function broadcastAs()
    {
        return 'space.created';
    }

    public function broadcastWith()
    {
        return [
            'space' => [
                'id' => $this->space->id,
                'title' => $this->space->title,
                'space_type' => $this->space->space_type,
                'description' => $this->space->description,
                'created_at' => $this->space->created_at->toISOString(),
            ],
            'creator' => [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
                'profile_photo' => $this->creator->profile_photo,
            ],
            'creator_id' => $this->creator->id,
            'timestamp' => now()->toISOString()
        ];
    }
}