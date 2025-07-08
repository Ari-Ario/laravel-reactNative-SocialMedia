<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Comment;
use App\Models\User;
use App\Models\Post;

class CommentsTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run()
    {
        // Clear existing comments
        // Comment::truncate();

        $users = User::pluck('id')->toArray();
        $posts = Post::pluck('id')->toArray();
        $faker = \Faker\Factory::create();

        // Create 5 comments for each post (20 posts × 5 = 100 comments)
        foreach ($posts as $postId) {
            for ($i = 0; $i < 5; $i++) {
                Comment::create([
                    'user_id' => $users[array_rand($users)],
                    'post_id' => $postId,
                    'parent_id' => null, // Top-level comments
                    'content' => $faker->sentence(rand(5, 15)) . ' ' . 
                                $faker->randomElement(['😊', '👏', '🔥', '💯']),
                ]);
            }
        }
    }
}
