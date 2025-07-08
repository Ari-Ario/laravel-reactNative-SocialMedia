<?php

namespace Database\Seeders;
use Database\Seeders\UsersTableSeeder;


use App\Models\User;
use App\Models\Post;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {

        // Create 20 posts with random users
        \App\Models\Post::factory()->count(20)->create();

        $this->call([
            UsersTableSeeder::class,
        ]);
        // User::factory(10)->create();

        // User::factory()->create([
        //     'name' => 'Test User',
        //     'email' => 'test@example.com',
        // ]);


        $this->call([
            UsersTableSeeder::class,
            PostsTableSeeder::class,
            ReactionsTableSeeder::class,
        ]);

        $this->call([
            UsersTableSeeder::class,
            PostsTableSeeder::class,
            ReactionsTableSeeder::class,
            CommentsTableSeeder::class,
        ]);

        $this->call([
            // ... other seeders
            StoriesTableSeeder::class,
        ]);

    }
}
