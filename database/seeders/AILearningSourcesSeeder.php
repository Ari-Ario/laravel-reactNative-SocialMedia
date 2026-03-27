<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AILearningSourcesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // \App\Models\AILearningSource::truncate();

        $interactions = \App\Models\AIInteraction::all();

        foreach ($interactions as $interaction) {
            \App\Models\AILearningSource::create([
                'ai_interaction_id' => $interaction->id, // UUID → UUID ✅
                'related_post_id' => \App\Models\Post::inRandomOrder()->value('id'),
                'extracted_patterns' => ['engagement','tone'],
                'learned_concepts' => ['positive_feedback'],
                'added_to_training' => rand(0,1),
            ]);
        }
    }
}
