<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\BroadcastMessage;

class MessageReactedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $reactor;
    public $message;
    public $spaceId;
    public $reaction;

    /**
     * Create a new notification instance.
     */
    public function __construct($reactor, $message, $reaction, $spaceId = null)
    {
        $this->reactor = $reactor;
        $this->message = $message;
        $this->reaction = $reaction;
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
        // $this->message can be an array or object because of how SpaceController stores json
        $messageArray = is_array($this->message) ? $this->message : (array)$this->message;
        $type = $messageArray['type'] ?? 'text';
        $content = $messageArray['content'] ?? '';
        $messageId = $messageArray['id'] ?? '';

        // Extract poll question if it's a poll
        if ($type === 'poll') {
            $metadata = $messageArray['metadata'] ?? [];
            if (is_string($metadata))
                $metadata = json_decode($metadata, true);
            $pollData = $metadata['pollData'] ?? $metadata['poll'] ?? null;
            $question = $pollData['question'] ?? str_replace('Poll: ', '', $content) ?: 'a poll';
            $shortText = mb_strlen($question) > 30 ? mb_substr($question, 0, 30) . '...' : $question;
            $notifMessage = "{$this->reactor->name} reacted {$this->reaction} to your poll: \"{$shortText}\"";
        }
        else {
            $shortText = mb_strlen($content) > 30 ? mb_substr($content, 0, 30) . '...' : ($content ?: 'an attachment');
            $notifMessage = "{$this->reactor->name} reacted {$this->reaction} to your message: \"{$shortText}\"";
        }

        return [
            'type' => 'message_reaction',
            'title' => 'New Reaction',
            'message' => $notifMessage,
            'userId' => $this->reactor->id,
            'profile_photo' => $this->reactor->profile_photo,
            'messageId' => $messageId,
            'spaceId' => $this->spaceId,
            'reaction' => $this->reaction,
        ];
    }

    /**
     * Get the broadcastable representation of the notification.
     */
    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'data' => $this->toArray($notifiable),
            'type' => 'message_reaction',
        ]);
    }
}