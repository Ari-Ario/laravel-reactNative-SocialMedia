<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use App\Models\CollaborationSpace;

class MagicEventsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // \App\Models\MagicEvent::truncate();

        foreach (CollaborationSpace::all() as $space) {
            \App\Models\MagicEvent::create([
                'id' => Str::uuid(),
                'space_id' => $space->id,
                'event_type' => 'ai_suggestion',
                'event_data' => ['message' => 'AI suggested next step'],
            ]);
        }
    }
}
