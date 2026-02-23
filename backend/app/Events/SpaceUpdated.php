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

class SpaceUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $space;
    public $userId;
    public $changes;

    public function __construct(CollaborationSpace $space, $userId = null, $changes = [])
    {
        // Make sure space is properly loaded
        if ($space && !$space->relationLoaded('creator')) {
            $space->load('creator');
        }
        
        $this->space = $space;
        $this->userId = $userId;
        $this->changes = $changes;
    }

    public function broadcastOn()
    {
        // Add null check for space
        if (!$this->space) {
            return []; // Return empty array if space is null
        }
        $followerIds = Auth::user()->followers()->pluck('users.id')->toArray();
    
        return [
            new Channel('spaces'),
            new PresenceChannel('space.' . $this->space->id),
            new PrivateChannel('user.' . $this->userId),
        ];
    }

    public function broadcastAs()
    {
        return 'space.updated';
    }

    public function broadcastWith()
    {
        // Add null checks
        if (!$this->space) {
            return [
                'error' => 'Space not found',
                'timestamp' => now()->toISOString()
            ];
        }
        
        return [
            'space' => [
                'id' => $this->space->id,
                'title' => $this->space->title,
                'space_type' => $this->space->space_type,
                'content_state' => $this->space->content_state,
                'updated_at' => $this->space->updated_at->toISOString(),
            ],
            'updated_by' => $this->userId,
            'changes' => $this->changes,
            'timestamp' => now()->toISOString()
        ];
    }


public function callSignal(Request $request, $id)
{
    $request->validate([
        'type' => 'required|in:offer,answer,ice-candidate',
        'target_user_id' => 'required|exists:users,id',
        'call_id' => 'required|string',
        'offer' => 'required_if:type,offer',
        'answer' => 'required_if:type,answer',
        'candidate' => 'required_if:type,ice-candidate',
    ]);
    
    $space = CollaborationSpace::findOrFail($id);
    $user = auth()->user();
    
    // Forward the signal to the target user
    broadcast(new \App\Events\WebRTCSignal(
        $space,
        $user,
        $request->target_user_id,
        $request->type,
        $request->only(['offer', 'answer', 'candidate']),
        $request->call_id
    ))->toOthers();
    
    return response()->json(['success' => true]);
}

public function callMute(Request $request, $id)
{
    $request->validate([
        'is_muted' => 'required|boolean',
        'call_id' => 'required|string',
    ]);
    
    $space = CollaborationSpace::findOrFail($id);
    $user = auth()->user();
    
    broadcast(new \App\Events\CallMuteStateChanged($space, $user, $request->is_muted))->toOthers();
    
    return response()->json(['success' => true]);
}

public function callVideo(Request $request, $id)
{
    $request->validate([
        'has_video' => 'required|boolean',
        'call_id' => 'required|string',
    ]);
    
    $space = CollaborationSpace::findOrFail($id);
    $user = auth()->user();
    
    broadcast(new \App\Events\CallVideoStateChanged($space, $user, $request->has_video))->toOthers();
    
    return response()->json(['success' => true]);
}

public function callScreenShare(Request $request, $id)
{
    $request->validate([
        'is_sharing' => 'required|boolean',
        'call_id' => 'required|string',
    ]);
    
    $space = CollaborationSpace::findOrFail($id);
    $user = auth()->user();
    
    broadcast(new \App\Events\ScreenShareToggled($space, $user, $request->is_sharing))->toOthers();
    
    return response()->json(['success' => true]);
}

}