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
 * Sent to every participant when a call starts in their space.
 * Delivers via:
 *  - database  → persistent notification store
 *  - broadcast → real-time via Reverb (for users online)
 *  - WebPush   → VAPID browser push (for users offline/backgrounded on web)
 *  - Expo      → native push (for iOS/Android device users)
 */
class IncomingCallNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public $space,
        public $call,
        public $caller
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class, ExpoChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'          => 'call',
            'title'         => '📞 Incoming Call',
            'message'       => "{$this->caller->name} is calling in \"{$this->space->title}\"",
            'body'          => "{$this->caller->name} is calling in \"{$this->space->title}\"",
            'userId'        => $this->caller->id,
            'profile_photo' => $this->caller->profile_photo,
            'spaceId'       => $this->space->id,
            'callId'        => $this->call->id,
            'callType'      => $this->call->type,
            'data'          => [
                'type'    => 'call',
                'spaceId' => $this->space->id,
                'callId'  => $this->call->id,
            ],
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'data' => $this->toArray($notifiable),
            'type' => 'call',
        ]);
    }

    /**
     * Web Push (VAPID): shows a persistent banner with vibration even when browser is closed.
     */
    public function toWebPush(object $notifiable, $notification): WebPushMessage
    {
        return (new WebPushMessage)
            ->title('📞 Incoming Call')
            ->icon('/favicon.png')
            ->body("{$this->caller->name} is calling in \"{$this->space->title}\"")
            ->data($this->toArray($notifiable))
            ->action('Accept', 'accept')
            ->action('Decline', 'decline');
    }

    /**
     * Expo Push (native mobile).
     */
    public function toExpoPush(object $notifiable): ExpoMessage
    {
        return ExpoMessage::create()
            ->title('📞 Incoming Call')
            ->body("{$this->caller->name} is calling in \"{$this->space->title}\"")
            ->playSound()
            ->channelId('default')
            ->data($this->toArray($notifiable));
    }
}
