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
    ) {
        $this->space = $space;
        $this->fromUser = $fromUser;
        $this->toUserId = $toUserId;
        $this->signalType = $signalType;
        $this->signalData = $signalData;
        $this->callId = $callId;
    }

    public function broadcastOn()
    {
        return [
            new PresenceChannel('presence-space.' . $this->space->id),
            new PrivateChannel('user.' . $this->toUserId),
        ];
    }

    public function broadcastAs()
    {
        return 'webrtc.signal';
    }

    public function broadcastWith()
    {
        return [
            'from_user_id' => $this->fromUser->id,
            'from_user_name' => $this->fromUser->name,
            'type' => $this->signalType,
            'offer' => $this->signalData['offer'] ?? null,
            'answer' => $this->signalData['answer'] ?? null,
            'candidate' => $this->signalData['candidate'] ?? null,
            'call_id' => $this->callId,
            'timestamp' => now()->toISOString(),
        ];
    }
}