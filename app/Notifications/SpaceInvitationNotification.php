<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\BroadcastMessage;
use NotificationChannels\Expo\ExpoChannel;
use NotificationChannels\Expo\ExpoMessage;

class SpaceInvitationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $space;
    public $inviter;

    /**
     * Create a new notification instance.
     */
    public function __construct($space, $inviter)
    {
        $this->space = $space;
        $this->inviter = $inviter;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'broadcast', ExpoChannel::class];
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'space_invitation',
            'title' => 'Space Invitation',
            'message' => "{$this->inviter->name} invited you to join \"{$this->space->title}\"",
            'userId' => $this->inviter->id,
            'profile_photo' => $this->inviter->profile_photo,
            'spaceId' => $this->space->id,
            'data' => [
                'space' => [
                    'id' => $this->space->id,
                    'title' => $this->space->title,
                ],
            ],
        ];
    }

    /**
     * Get the broadcastable representation of the notification.
     */
    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'data' => $this->toArray($notifiable),
            'type' => 'space_invitation',
        ]);
    }

    /**
     * Get the Expo representation of the notification.
     */
    public function toExpoPush(object $notifiable): ExpoMessage
    {
        return ExpoMessage::create()
            ->title('New Space Invitation')
            ->body("{$this->inviter->name} invited you to join \"{$this->space->title}\"")
            ->playSound()
            ->channelId('default')
            ->data($this->toArray($notifiable));
    }
}