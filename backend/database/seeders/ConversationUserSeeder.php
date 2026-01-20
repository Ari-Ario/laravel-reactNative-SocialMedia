<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ConversationUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (DB::table('conversation_user')->count() > 0) {
            return;
        }

        $users = DB::table('users')->pluck('id');
        $conversations = DB::table('conversations')->pluck('id');

        foreach ($conversations as $conversationId) {
            foreach ($users->random(2) as $userId) {
                DB::table('conversation_user')->insert([
                    'conversation_id' => $conversationId,
                    'user_id' => $userId,
                    'joined_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }
}
