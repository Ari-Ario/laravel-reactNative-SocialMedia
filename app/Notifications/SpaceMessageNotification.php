<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\BroadcastMessage;
use NotificationChannels\Expo\ExpoChannel;
use NotificationChannels\Expo\ExpoMessage;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

/**
 * Sent to every participant when a new message is sent in their space.
 * Delivers via:
 *  - database  → persistent notification store
 *  - broadcast → real-time via Reverb (for users online)
 *  - WebPush   → VAPID browser push (for users offline/backgrounded on web)
 *  - Expo      → native push (for iOS/Android device users)
 */
class SpaceMessageNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public array $msg,
        public string $spaceId,
        public $sender,
        public string $spaceTitle = ''
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class, ExpoChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        $type = $this->msg['type'] ?? 'text';
        $content = $this->msg['content'] ?? '';

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
            'type'          => 'new_message',
            'title'         => '💬 ' . $this->sender->name,
            'userName'      => $this->sender->name,
            'message'       => $displayText,
            'body'          => $displayText,
            'userId'        => $this->sender->id,
            'profile_photo' => $this->sender->profile_photo,
            'spaceId'       => $this->spaceId,
            'spaceTitle'    => $this->spaceTitle,
            'messageId'     => $this->msg['id'] ?? null,
            'timestamp'     => now()->toISOString(),
            'created_at'    => now()->toISOString(), // Added for frontend compatibility
            'data'          => [
                'type'    => 'message',
                'spaceId' => $this->spaceId,
            ],
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'data' => $this->toArray($notifiable),
            'type' => 'new_message',
        ]);
    }

    /**
     * Web Push (VAPID): shows a persistent banner for messages.
     */
    public function toWebPush(object $notifiable, $notification): WebPushMessage
    {
        $data = $this->toArray($notifiable);
        $title = $this->spaceTitle ? "💬 {$this->sender->name} in [{$this->spaceTitle}]" : "💬 {$this->sender->name}";
        
        return (new WebPushMessage)
            ->title($title)
            ->icon('/logo.svg')
            ->body($data['message'])
            ->data($data)
            ->options(['TTL' => 1000]);
    }

    /**
     * Expo Push (native mobile).
     */
    public function toExpoPush(object $notifiable): ExpoMessage
    {
        $data = $this->toArray($notifiable);
        $title = $this->spaceTitle ? "💬 {$this->sender->name} in [{$this->spaceTitle}]" : "💬 {$this->sender->name}";
        
        return ExpoMessage::create()
            ->title($title)
            ->body($data['message'])
            ->playSound()
            ->channelId('default')
            ->data($data);
    }
}
