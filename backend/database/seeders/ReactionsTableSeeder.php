<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Reaction;
use App\Models\User;
use App\Models\Post;

class ReactionsTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run()
    {
        // Clear existing reactions
        Reaction::truncate();

        $users = User::pluck('id')->toArray();
        $posts = Post::pluck('id')->toArray();
        $emojis = ['👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '💯', '🤯', '🙌']; // Common reaction emojis

        // Create 80 random reactions
        for ($i = 0; $i < 400; $i++) {
            try {
                Reaction::create([
                    'user_id' => $users[array_rand($users)],
                    'post_id' => $posts[array_rand($posts)],
                    'emoji' => $emojis[array_rand($emojis)],
                ]);
            } catch (\Exception $e) {
                // Skip duplicate user-post pairs (due to unique constraint)
                continue;
            }
        }
    }

}
