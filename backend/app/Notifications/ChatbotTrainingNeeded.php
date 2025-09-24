<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

class ChatbotTrainingNeeded extends Notification implements ShouldQueue
{
    use Queueable;

    public $message;
    public $category;
    public $keywords;

    public function __construct($message, $category, $keywords)
    {
        $this->message = $message;
        $this->category = $category;
        $this->keywords = $keywords;
    }

    public function via($notifiable)
    {
        Log::info('📧 Notification via method called', [
            'notifiable_id' => $notifiable->id,
            'notifiable_email' => $notifiable->email,
            'channels' => ['mail', 'database'] // Add database if you want to store notifications
        ]);
        
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        Log::info('📧 Preparing email notification', [
            'to' => $notifiable->email,
            'message' => $this->message
        ]);

        return (new MailMessage)
            ->subject('🤖 Chatbot Training Needed')
            ->greeting('Hello ' . $notifiable->name . '!')
            ->line('The chatbot needs training for a new message:')
            ->line('**Message:** ' . $this->message)
            ->line('**Category:** ' . $this->category)
            ->line('**Keywords:** ' . implode(', ', $this->keywords))
            ->action('Train Chatbot', url('/chatbot-training'))
            ->line('Thank you for helping improve our chatbot!');
    }

    public function toArray($notifiable)
    {
        return [
            'message' => $this->message,
            'category' => $this->category,
            'keywords' => $this->keywords,
        ];
    }
}