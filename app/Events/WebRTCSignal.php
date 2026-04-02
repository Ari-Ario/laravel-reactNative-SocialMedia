<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
// NOTE: SerializesModels intentionally REMOVED — it causes Eloquent model data
// to bloat the serialized event payload, easily exceeding Reverb/Pusher's 10KB limit.
// We store only scalar values so the payload stays minimal.
use App\Models\CollaborationSpace;
use App\Models\User;

class WebRTCSignal implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    // Store only scalar IDs — no Eloquent models in properties
    private string $spaceId;
    private int    $fromUserId;
    private string $fromUserName;

    public int    $toUserId;
    public string $signalType;
    public array  $signalData;
    public string $callId;

    public function __construct(
        CollaborationSpace $space,
        User $fromUser,
        $toUserId,
        $signalType,
        $signalData,
        $callId
    ) {
        // Extract only the scalar values we need — discard the heavy model objects
        $this->spaceId      = $space->id;
        $this->fromUserId   = $fromUser->id;
        $this->fromUserName = $fromUser->name;
        $this->toUserId     = (int) $toUserId;
        $this->signalType   = $signalType;
        $this->signalData   = $signalData ?? [];
        $this->callId       = $callId;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('space-' . $this->spaceId);
    }

    public function broadcastAs()
    {
        return 'webrtc-signal';
    }

    public function broadcastWith()
    {
        // Build the minimal payload — signalData contains offer/answer/candidate
        $payload = array_merge($this->signalData, [
            'from_user_id'   => $this->fromUserId,
            'from_user_name' => $this->fromUserName,
            'target_user_id' => $this->toUserId,
            'type'           => $this->signalType,
            'call_id'        => $this->callId,
            'timestamp'      => now()->toISOString(),
        ]);

        \Illuminate\Support\Facades\Log::debug("📡 WebRTCSignal: {$this->signalType} space={$this->spaceId} from={$this->fromUserId} to={$this->toUserId}");

        return $payload;
    }
}