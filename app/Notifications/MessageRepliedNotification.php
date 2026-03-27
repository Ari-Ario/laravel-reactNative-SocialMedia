<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\BroadcastMessage;

class MessageRepliedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $replier;
    public $originalMessage;
    public $replyMessage;
    public $spaceId;

    /**
     * Create a new notification instance.
     */
    public function __construct($replier, $originalMessage, $replyMessage, $spaceId = null)
    {
        $this->replier = $replier;
        $this->originalMessage = $originalMessage;
        $this->replyMessage = $replyMessage;
        $this->spaceId = $spaceId;
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
        $originalMessageArray = is_array($this->originalMessage) ? $this->originalMessage : (array)$this->originalMessage;
        $origContent = $originalMessageArray['content'] ?? '';
        $origType = $originalMessageArray['type'] ?? 'text';

        $replyMessageArray = is_array($this->replyMessage) ? $this->replyMessage : (array)$this->replyMessage;
        $replyContent = $replyMessageArray['content'] ?? '';
        $replyId = $replyMessageArray['id'] ?? '';

        // Extract poll question if original message is a poll
        if ($origType === 'poll') {
            $metadata = $originalMessageArray['metadata'] ?? [];
            if (is_string($metadata))
                $metadata = json_decode($metadata, true);
            $pollData = $metadata['pollData'] ?? $metadata['poll'] ?? null;
            $question = $pollData['question'] ?? str_replace('Poll: ', '', $origContent) ?: 'a poll';
            $shortOrig = mb_strlen($question) > 20 ? mb_substr($question, 0, 20) . '...' : $question;
            $messageLabel = 'poll';
        }
        else {
            $shortOrig = mb_strlen($origContent) > 20 ? mb_substr($origContent, 0, 20) . '...' : ($origContent ?: 'an attachment');
            $messageLabel = 'message';
        }

        $shortReply = mb_strlen($replyContent) > 30 ? mb_substr($replyContent, 0, 30) . '...' : ($replyContent ?: 'an attachment');

        return [
            'type' => 'message_reply',
            'title' => 'New Reply',
            'message' => "{$this->replier->name} replied to your {$messageLabel} \"{$shortOrig}\": \"{$shortReply}\"",
            'userId' => $this->replier->id,
            'profile_photo' => $this->replier->profile_photo,
            'messageId' => $replyId,
            'spaceId' => $this->spaceId,
        ];
    }

    /**
     * Get the broadcastable representation of the notification.
     */
    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'data' => $this->toArray($notifiable),
            'type' => 'message_reply',
        ]);
    }
}