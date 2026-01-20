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
            // UserPreferencesSeeder::class,

            PostsTableSeeder::class,
            StoriesTableSeeder::class,
            CommentsTableSeeder::class,
            ReactionsTableSeeder::class,
            CommentReactionsTableSeeder::class,

            ConversationsTableSeeder::class,
            ConversationUserSeeder::class,
            MessagesTableSeeder::class,

            CollaborationSpacesSeeder::class,
            SpaceParticipationsSeeder::class,
            MagicEventsSeeder::class,

            AIInteractionsSeeder::class,
            AILearningSourcesSeeder::class,
        ]);

    }
}
