<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\CollaborationSpace;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SpaceParticipationsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (DB::table('space_participations')->count() > 0) {
            return;
        }

        foreach (DB::table('collaboration_spaces')->get() as $space) {
            foreach (DB::table('users')->inRandomOrder()->limit(3)->get() as $user) {
                DB::table('space_participations')->insert([
                    'space_id' => $space->id,
                    'user_id' => $user->id,
                    'role' => 'participant',
                    'last_active_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }
}
