<?php
// app/Events/MessageSent.php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;
use NotificationChannels\Expo\ExpoChannel;
use NotificationChannels\Expo\ExpoMessage;
use Illuminate\Notifications\Notification;

class MessageSent extends Notification implements ShouldBroadcastNow
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
        return ['database', WebPushChannel::class, ExpoChannel::class];
    }

    /**
     * Get the array representation of the notification for the database.
     */
    public function toArray($notifiable)
    {
        $type = $this->message['type'] ?? 'text';
        $content = $this->message['content'] ?? '';

        $displayText = match ($type) {
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
            'userName' => $this->user?->name ?? 'System',
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
     * Web Push (VAPID): shows a persistent banner for messages.
     */
    public function toWebPush($notifiable, $notification): WebPushMessage
    {
        $data = $this->toArray($notifiable);
        
        return (new WebPushMessage)
            ->title('💬 ' . ($this->user->name ?? 'New Message'))
            ->icon('/logo.svg')
            ->body($data['message'])
            ->data($data)
            ->options(['TTL' => 1000]);
    }

    /**
     * Expo Push (native mobile).
     */
    public function toExpoPush($notifiable): ExpoMessage
    {
        $data = $this->toArray($notifiable);
        
        return ExpoMessage::create()
            ->title('💬 ' . ($this->user->name ?? 'New Message'))
            ->body($data['message'])
            ->playSound()
            ->channelId('default')
            ->data($data);
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
            'profile_photo' => $this->user->profile_photo ?? null, // ✅ Added for notification consistency
            'created_at' => now()->toISOString(),
            'timestamp' => now()->toISOString(),
        ];
    }
}