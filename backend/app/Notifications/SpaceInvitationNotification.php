<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use App\Models\CollaborationSpace;

class SpaceInvitationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $space;
    public $inviter;
    public $message;

    /**
     * Create a new notification instance.
     */
    public function __construct(CollaborationSpace $space, $inviter, $message = null)
    {
        $this->space = $space;
        $this->inviter = $inviter;
        $this->message = $message;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        // Return only database and broadcast for now
        return ['database', 'broadcast'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        // Create a deep link for your mobile app
        $deepLink = "yourapp://spaces/{$this->space->id}/join";
        
        return (new MailMessage)
            ->subject('You\'ve been invited to a collaboration space!')
            ->greeting('Hello ' . $notifiable->name . '!')
            ->line($this->inviter->name . ' has invited you to join "' . $this->space->title . '"')
            ->line($this->message ? 'Message: ' . $this->message : '')
            ->action('Join Space', $deepLink)
            ->line('This space is for: ' . ($this->space->description ?? 'Collaboration'))
            ->line('Thank you for using our application!');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        // Create a deep link for mobile app
        $deepLink = "yourapp://spaces/{$this->space->id}";
        
        return [
            'type' => 'space_invitation',
            'space_id' => $this->space->id,
            'space_title' => $this->space->title,
            'space_type' => $this->space->space_type,
            'inviter_id' => $this->inviter->id,
            'inviter_name' => $this->inviter->name,
            'inviter_avatar' => $this->inviter->profile_photo,
            'message' => $this->message,
            'deep_link' => $deepLink,
            'timestamp' => now()->toISOString(),
            'action_url' => url("/api/spaces/{$this->space->id}/accept-invitation"),
        ];
    }

    /**
     * Get the broadcastable representation of the notification.
     */
    public function toBroadcast(object $notifiable): array
    {
        return [
            'id' => $this->id,
            'type' => 'space_invitation',
            'data' => $this->toArray($notifiable),
            'read_at' => null,
            'created_at' => now()->toISOString(),
        ];
    }

    /**
     * Determine the notification's database type.
     */
    public function databaseType(object $notifiable): string
    {
        return 'space-invitation';
    }
}