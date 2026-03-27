<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Story;
use App\Models\User;
use Carbon\Carbon;

class StoriesTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run()
    {
        // Clear only expired stories (optional)
        Story::where('expires_at', '<', now())->delete();
        
        $users = User::all();
        $media = [
            'stories/image1.jpg',
            'stories/image2.jpg',
            'stories/video1.mp4',
            'stories/video2.mp4',
        ];
        
        $captions = [
            "Check this out!",
            "My day so far 👀",
            "Behind the scenes...",
            "What do you think?",
            null // Some stories without captions
        ];

        foreach ($users as $user) {
            for ($i = 0; $i < 4; $i++) {
                $createdAt = now()->subMinutes(rand(0, 60)); // Random time in last hour
                
                Story::create([
                    'user_id' => $user->id,
                    'media_path' => $media[array_rand($media)],
                    'caption' => $captions[array_rand($captions)],
                    'expires_at' => $createdAt->copy()->addHours(24),
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);
            }
        }
    }
}
