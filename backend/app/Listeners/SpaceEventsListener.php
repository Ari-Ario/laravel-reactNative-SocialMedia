<?php

namespace App\Listeners;

use App\Events\SpaceUpdated;
use App\Events\ParticipantJoined;
use App\Events\MagicEventTriggered;
use App\Events\VoiceAnnotationAdded;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Pusher\Pusher;

class SpaceEventsListener
{
    private $pusher;
    
    public function __construct()
    {
        $this->pusher = new Pusher(
            config('broadcasting.connections.pusher.key'),
            config('broadcasting.connections.pusher.secret'),
            config('broadcasting.connections.pusher.app_id'),
            config('broadcasting.connections.pusher.options')
        );
    }
    
    public function handleSpaceUpdated(SpaceUpdated $event)
    {
        // Broadcast space update to all participants
        $this->pusher->trigger(
            "space-{$event->space->id}",
            'space-updated',
            [
                'space' => $event->space,
                'updated_by' => $event->user->id,
                'changes' => $event->changes,
                'timestamp' => now()->toISOString(),
            ]
        );
    }
    
    public function handleParticipantJoined(ParticipantJoined $event)
    {
        // Broadcast new participant
        $this->pusher->trigger(
            "space-{$event->space->id}",
            'participant-joined',
            [
                'user' => $event->user,
                'role' => $event->role,
                'timestamp' => now()->toISOString(),
            ]
        );
        
        // Also broadcast to user-specific channel for notifications
        $this->pusher->trigger(
            "user-{$event->user->id}",
            'space-invitation',
            [
                'space' => $event->space,
                'invited_by' => $event->invitedBy->id,
                'message' => "You've been invited to join {$event->space->title}",
            ]
        );
    }
    
    public function handleMagicEventTriggered(MagicEventTriggered $event)
    {
        // Broadcast magic event
        $this->pusher->trigger(
            "space-{$event->space->id}",
            'magic-triggered',
            [
                'event' => $event->magicEvent,
                'triggered_by' => $event->user->id,
                'discovery_hint' => $this->generateDiscoveryHint($event->magicEvent),
            ]
        );
    }
    
    public function handleVoiceAnnotationAdded(VoiceAnnotationAdded $event)
    {
        // Broadcast voice annotation to space
        $this->pusher->trigger(
            "space-{$event->post->linked_project_id}",
            'voice-annotation-added',
            [
                'post_id' => $event->post->id,
                'user_id' => $event->user->id,
                'annotation' => end($event->post->voice_annotations),
                'timestamp' => now()->toISOString(),
            ]
        );
    }
}