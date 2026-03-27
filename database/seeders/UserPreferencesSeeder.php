<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\UserPreference;

class UserPreferencesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // UserPreference::truncate();

        foreach (User::all() as $user) {
            UserPreference::create([
                'user_id' => $user->id,
                'theme' => 'dark',
                'locale' => 'en',
                'collaboration_styles' => ['prefers' => 'chat'],
                'synergy_traits' => ['focus', 'creative'],
                'global_cooperation_score' => rand(10, 100),
            ]);
        }
    }
}
