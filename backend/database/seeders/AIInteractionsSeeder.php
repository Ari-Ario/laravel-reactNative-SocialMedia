<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class AIInteractionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // \App\Models\AIInteraction::truncate();

        $spaces = \App\Models\CollaborationSpace::all();
        $users = \App\Models\User::all();

        foreach ($spaces as $space) {
            for ($i = 0; $i < 5; $i++) {
                \App\Models\AIInteraction::create([
                    'id' => Str::uuid(),
                    'space_id' => $space->id,
                    'user_id' => $users->random()->id,
                    'interaction_type' => 'suggestion',
                    'user_input' => fake()->sentence(),
                    'ai_response' => fake()->paragraph(),
                    'confidence_score' => rand(70, 95),
                ]);
            }
        }
    }
}
