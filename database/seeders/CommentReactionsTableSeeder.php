<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\ReactionComment;
use App\Models\User;
use App\Models\Comment;

class CommentReactionsTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run()
    {
        // Clear existing reactions
        ReactionComment::truncate();

        $users = User::pluck('id')->toArray();
        $comments = Comment::pluck('id')->toArray();
        $emojis = ['👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '💯', '🤯', '🙌'];

        // Create 10 reactions for each comment
        foreach ($comments as $commentId) {
            // Select 10 random users (may include duplicates - handled by unique constraint)
            $selectedUsers = array_rand(array_flip($users), 10);
            
            foreach ($selectedUsers as $userId) {
                try {
                    ReactionComment::create([
                        'user_id' => $userId,
                        'comment_id' => $commentId,
                        'emoji' => $emojis[array_rand($emojis)],
                        'created_at' => now()->subDays(rand(0, 30)), // Random timestamps
                    ]);
                } catch (\Illuminate\Database\QueryException $e) {
                    // Skip duplicate user-comment pairs
                    continue;
                }
            }
        }
    }
}
