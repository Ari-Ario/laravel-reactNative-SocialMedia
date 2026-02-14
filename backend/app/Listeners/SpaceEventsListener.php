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
        // Add null check for space
        if (!$event->space) {
            \Log::error('SpaceUpdated event triggered with null space');
            return;
        }
        
        try {
            // Broadcast space update to all participants
            $this->pusher->trigger(
                "presence-space-{$event->space->id}",
                'space-updated',
                [
                    'space' => [
                        'id' => $event->space->id,
                        'title' => $event->space->title,
                        'space_type' => $event->space->space_type,
                        'content_state' => $event->space->content_state,
                        'updated_at' => $event->space->updated_at,
                    ],
                    'updated_by' => $event->userId,
                    'changes' => $event->changes,
                    'timestamp' => now()->toISOString(),
                ]
            );
        } catch (\Exception $e) {
            \Log::error('Error broadcasting space update: ' . $e->getMessage());
        }
    }
    
    public function handleParticipantJoined(ParticipantJoined $event)
    {
        // Add null checks
        if (!$event->space || !$event->user) {
            \Log::error('ParticipantJoined event triggered with null data');
            return;
        }
        
        try {
            // Broadcast new participant
            $this->pusher->trigger(
                "presence-space-{$event->space->id}",
                'participant-joined',
                [
                    'user' => [
                        'id' => $event->user->id,
                        'name' => $event->user->name,
                        'profile_photo' => $event->user->profile_photo,
                    ],
                    'role' => $event->role,
                    'timestamp' => now()->toISOString(),
                ]
            );
            
            // Also broadcast to user-specific channel for notifications
            $this->pusher->trigger(
                "user-{$event->user->id}",
                'space-invitation',
                [
                    'space' => [
                        'id' => $event->space->id,
                        'title' => $event->space->title,
                        'space_type' => $event->space->space_type,
                    ],
                    'invited_by' => $event->invitedBy->id ?? null,
                    'message' => "You've been invited to join {$event->space->title}",
                ]
            );
        } catch (\Exception $e) {
            \Log::error('Error broadcasting participant joined: ' . $e->getMessage());
        }
    }
    
    public function handleMagicEventTriggered(MagicEventTriggered $event)
    {
        // Add null checks
        if (!$event->space || !$event->magicEvent) {
            \Log::error('MagicEventTriggered event triggered with null data');
            return;
        }
        
        try {
            // Broadcast magic event
            $this->pusher->trigger(
                "presence-space-{$event->space->id}",
                'magic-triggered',
                [
                    'event' => [
                        'id' => $event->magicEvent->id,
                        'event_type' => $event->magicEvent->event_type,
                        'event_data' => $event->magicEvent->event_data,
                        'has_been_discovered' => $event->magicEvent->has_been_discovered,
                    ],
                    'triggered_by' => $event->user->id ?? null,
                    'discovery_hint' => $this->generateDiscoveryHint($event->magicEvent),
                    'timestamp' => now()->toISOString(),
                ]
            );
        } catch (\Exception $e) {
            \Log::error('Error broadcasting magic event: ' . $e->getMessage());
        }
    }
    
    public function handleVoiceAnnotationAdded(VoiceAnnotationAdded $event)
    {
        // Add null checks
        if (!$event->post) {
            \Log::error('VoiceAnnotationAdded event triggered with null post');
            return;
        }
        
        try {
            // Broadcast voice annotation to space
            $this->pusher->trigger(
                "presence-space-{$event->post->linked_project_id}",
                'voice-annotation-added',
                [
                    'post_id' => $event->post->id,
                    'user_id' => $event->user->id ?? null,
                    'annotation' => $event->post->voice_annotations ? end($event->post->voice_annotations) : null,
                    'timestamp' => now()->toISOString(),
                ]
            );
        } catch (\Exception $e) {
            \Log::error('Error broadcasting voice annotation: ' . $e->getMessage());
        }
    }
    
    private function generateDiscoveryHint($magicEvent)
    {
        if (!$magicEvent) return null;
        
        $hints = [
            'breakthrough' => 'Look for patterns in the conversation',
            'synergy' => 'Check team collaboration metrics',
            'creativity' => 'Explore divergent thinking paths',
            'insight' => 'Review recent discussions',
        ];
        
        return $hints[$magicEvent->event_type] ?? 'Explore the space to discover magic';
    }
}