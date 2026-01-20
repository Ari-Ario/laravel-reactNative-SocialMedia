<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CollaborationSpacesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // \App\Models\CollaborationSpace::truncate();

        $users = \App\Models\User::all();

        foreach ($users->take(5) as $user) {
            \App\Models\CollaborationSpace::create([
                'id' => Str::uuid(),
                'creator_id' => $user->id,
                'space_type' => 'chat',
                'title' => fake()->sentence(3),
                'has_ai_assistant' => true,
                'ai_personality' => fake()->randomElement(['coach','creative','analyst']),
                'ai_capabilities' => ['summarize','suggest','mediate'],
                'ai_learning_data' => [],
                'is_live' => true,
            ]);
        }
    }
}
