<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\BroadcastMessage;

class ViolationReported extends Notification
{
    use Queueable;


    public $report;

    /**
     * Create a new notification instance.
     */
    public function __construct($report)
    {
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
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'violation_reported',
            'title' => '🚨 AI Violation Alert',
            'message' => "New {$this->report->severity} severity report: {$this->report->category} ({$this->report->subcategory})",
            'reportId' => $this->report->report_id,
            'severity' => $this->report->severity,
            'targetType' => $this->report->target_type,
            'targetId' => $this->report->target_id,
            'createdAt' => now()->toIso8601String(),
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'data' => $this->toArray($notifiable),
            'type' => 'violation_reported',
        ]);
    }

    /**
     * Get the event name for the broadcast notification.
     */
    public function broadcastAs(): string
    {
        return 'violation.reported';
    }
}

