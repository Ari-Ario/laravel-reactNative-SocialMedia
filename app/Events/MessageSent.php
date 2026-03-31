<?php
// app/Events/MessageSent.php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Notifications\Notification as LaravelNotification;

class MessageSent extends LaravelNotification implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;
    public $spaceId;
    public $user;

    /**
     * Create a new event instance.
     */
    public function __construct($message, $spaceId, $user)
    {
        $this->message = $message;
        $this->spaceId = $spaceId;
        $this->user = $user;
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via($notifiable)
    {
        return ['database'];
    }

    /**
     * Get the array representation of the notification for the database.
     */
    public function toArray($notifiable)
    {
        $type = $this->message['type'] ?? 'text';
        $content = $this->message['content'] ?? '';
        
        $displayText = match($type) {
            'poll' => '📊 Poll: ' . ($content ?: 'New Poll'),
            'image' => '📷 Photo',
            'video' => '🎥 Video',
            'voice' => '🎤 Voice message',
            'audio' => '🎵 Audio',
            'file' => '📄 File',
            'album' => '🖼️ Album',
            'location' => '📍 Location',
            default => $content ?: 'New message'
        };

        return [
            'type' => 'new_message',
            'title' => 'New Message',
            'message' => (($this->user?->name ?? 'System')) . ': ' . $displayText,
            'messageId' => $this->message['id'] ?? null,
            'spaceId' => $this->spaceId,
            'userId' => $this->user?->id ?? 0,
            'profile_photo' => $this->user?->profile_photo ?? null,
            'timestamp' => now()->toISOString(),
            'created_at' => now()->toISOString(), // ✅ Added for frontend sorting compatibility
            'message_type' => $type,
            'file_path' => $this->message['file_path'] ?? null,
        ];
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn()
    {
        return [
            new PresenceChannel('space-' . $this->spaceId),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs()
    {
        return 'message-sent';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith()
    {
        return [
            'type' => 'new_message',
            'message' => $this->message,
            'spaceId' => $this->spaceId,
            'user' => $this->user,
            'created_at' => now()->toISOString(),
            'timestamp' => now()->toISOString(),
        ];
    }
}