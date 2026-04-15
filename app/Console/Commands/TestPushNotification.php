<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Notifications\IncomingCallNotification;
use App\Models\CollaborationSpace;
use App\Models\Call;

class TestPushNotification extends Command
{
    protected $signature = 'push:test {user_id}';
    protected $description = 'Trigger a test IncomingCallNotification for a specific user';

    public function handle()
    {
        $userId = $this->argument('user_id');
        $user = User::find($userId);

        if (!$user) {
            $this->error("User not found!");
            return;
        }

        // Create a dummy space and call for the notification
        $space = CollaborationSpace::first() ?: new CollaborationSpace(['id' => 1, 'title' => 'Test Space']);
        $call = Call::first() ?: new Call(['id' => 1, 'type' => 'video']);
        $caller = User::where('id', '!=', $userId)->first() ?: $user;

        $this->info("Sending IncomingCallNotification to User #{$userId} ({$user->name})...");
        
        try {
            $user->notify(new IncomingCallNotification($space, $call, $caller));
            $this->info("✅ Notification sent! Check the logs or your browser.");
        } catch (\Exception $e) {
            $this->error("❌ Failed to send: " . $e->getMessage());
        }
    }
}
