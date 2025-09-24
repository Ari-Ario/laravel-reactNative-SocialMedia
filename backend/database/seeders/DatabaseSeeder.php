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
        
        $this->call([
            UsersTableSeeder::class,
        ]);
        Post::factory(20)->create();


        $this->call([
            // UsersTableSeeder::class,
            // PostsTableSeeder::class,
            ReactionsTableSeeder::class,
            CommentsTableSeeder::class,
            StoriesTableSeeder::class,
        ]);

    }
}
