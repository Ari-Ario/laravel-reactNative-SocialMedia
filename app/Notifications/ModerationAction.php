<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ModerationAction extends Notification
{
    use Queueable;

    protected $restriction;
    protected $report;

    /**
     * Create a new notification instance.
     */
    public function __construct($restriction, $report = null)
    {
        $this->restriction = $restriction;
        $this->report = $report;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    /**
     * Get the array representation of the notification for database storage.
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'moderation_action',
            'sub_type' => $this->restriction->type,
            'reason' => $this->restriction->reason,
            'expires_at' => $this->restriction->expires_at?->toIso8601String(),
            'message' => $this->getHumanReadableMessage(),
            'report_details' => $this->report ? [
                'type' => $this->report->target_type,
                'category' => $this->report->category,
                'subcategory' => $this->report->subcategory,
                'description' => $this->report->description,
                'summary' => "Reported " . $this->report->target_type . " for " . $this->report->category . " - " . $this->report->subcategory . ". Action taken: " . $this->restriction->type . ".",
            ] : null,
        ];
    }

    /**
     * Get the broadcastable representation of the notification.
     */
    public function toBroadcast(object $notifiable): array
    {
        return [
            'data' => $this->toArray($notifiable),
        ];
    }

    private function getHumanReadableMessage()
    {
        switch ($this->restriction->type) {
            case 'warning':
                return "You have received a formal warning: {$this->restriction->reason}";
            case 'suspension':
                $expiry = $this->restriction->expires_at ? $this->restriction->expires_at->diffForHumans() : 'further notice';
                return "Your account has been suspended until {$expiry}. Reason: {$this->restriction->reason}";
            case 'ban':
                return "Your account has been permanently banned. Reason: {$this->restriction->reason}";
            default:
                return "A moderation action has been taken on your account.";
        }
    }
}
