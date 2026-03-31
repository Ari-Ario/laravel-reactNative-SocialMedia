<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\CollaborationSpace;
use App\Models\User;

class WebRTCSignal implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $fromUser;
    public $toUserId;
    public $signalType;
    public $signalData;
    public $callId;

    public function __construct(
        CollaborationSpace $space,
        User $fromUser,
        $toUserId,
        $signalType,
        $signalData,
        $callId
        )
    {
        $this->space = $space;
        $this->fromUser = $fromUser;
        $this->toUserId = $toUserId;
        $this->signalType = $signalType;
        $this->signalData = $signalData;
        $this->callId = $callId;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('space-' . $this->space->id);
    }

    public function broadcastAs()
    {
        return 'webrtc-signal';
    }

    public function broadcastWith()
    {
        $payload = array_merge($this->signalData, [
            'from_user_id' => $this->fromUser->id,
            'from_user_name' => $this->fromUser->name,
            'target_user_id' => $this->toUserId,
            'type' => $this->signalType,
            'call_id' => $this->callId,
            'timestamp' => now()->toISOString(),
        ]);

        \Illuminate\Support\Facades\Log::debug("📡 Broadcasting WebRTCSignal: {$this->signalType} to Space {$this->space->id}", [
            'target' => $this->toUserId,
            'from' => $this->fromUser->id,
            'type' => $this->signalType
        ]);

        return $payload;
    }
}