<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;

class UsersTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create 10 random users if table is empty
        if (User::count() === 0) {
            User::factory(10)->create();
        }

        // Create a specific test/admin user only if they do not exist
        if (!User::where('username', 'testuser')->exists()) {
            User::factory()->create([
                'name' => 'Test User',
                'username' => 'testuser',
                'email' => 'test@example.com',
            ]);
        }
    }
}
