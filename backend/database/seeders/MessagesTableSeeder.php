<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class MessagesTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // \App\Models\Message::truncate();

        $conversations = \App\Models\Conversation::all();

        foreach ($conversations as $conversation) {
            $participants = \DB::table('conversation_user')
                ->where('conversation_id', $conversation->id)
                ->pluck('user_id');

            $lastMessageId = null;

            for ($i = 0; $i < 15; $i++) {
                $message = \App\Models\Message::create([
                    'id' => Str::uuid(),
                    'conversation_id' => $conversation->id,
                    'user_id' => $participants->random(),
                    'content' => fake()->sentence(),
                    'reply_to_id' => rand(0,1) ? $lastMessageId : null,
                    'mood_detected' => fake()->randomElement(['happy','neutral','focused']),
                ]);

                $lastMessageId = $message->id;
            }

            // update conversation safely
            $conversation->update([
                'last_message_id' => $lastMessageId,
                'last_message_at' => now(),
            ]);
        }
    }
}
