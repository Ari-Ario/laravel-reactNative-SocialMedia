<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\CollaborationSpace;
use App\Models\User;

class VideoStateChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $user;
    public $hasVideo;

    public function __construct(CollaborationSpace $space, User $user, bool $hasVideo)
    {
        $this->space = $space;
        $this->user = $user;
        $this->hasVideo = $hasVideo;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('space.' . $this->space->id);
    }

    public function broadcastAs()
    {
        return 'video.state.changed';
    }

    public function broadcastWith()
    {
        return [
            'user_id' => $this->user->id,
            'user_name' => $this->user->name,
            'has_video' => $this->hasVideo,
            'timestamp' => now()->toISOString(),
        ];
    }
}