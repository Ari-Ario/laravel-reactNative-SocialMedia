<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UsersTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run()
    {
        // Clear the table first
        User::truncate();

        // Create 10 dummy users
        for ($i = 1; $i <= 10; $i++) {
            User::create([
                'name' => 'User ' . $i,
                'username' => 'user' . $i,
                'email' => 'user' . $i . '@example.com',
                'password' => Hash::make('password'), // All passwords are "password"
                'bio' => 'This is bio of user ' . $i,
                'birthday' => now()->subYears(rand(18, 40))->subDays(rand(0, 365)),
                'gender' => rand(0, 1) ? 'male' : 'female',
                'profile_photo' => 'default-profile.jpg',
                'job_title' => ['Developer', 'Designer', 'Manager', 'Writer'][rand(0, 3)],
                'company' => ['Google', 'Apple', 'Microsoft', 'Amazon'][rand(0, 3)],
                'location' => ['New York', 'London', 'Tokyo', 'Berlin'][rand(0, 3)],
                'is_admin' => $i === 1, // Make first user admin
            ]);
        }

        // Now seed posts
        \App\Models\Post::truncate(); // Clear existing posts

        for ($i = 1; $i <= 20; $i++) {
            \App\Models\Post::create([
                'user_id' => rand(1, 10), // Random user between 1-10
                'caption' => "This is post #$i by user " . rand(1, 10) . ". " . 
                            "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
            ]);
        }

    }
}
