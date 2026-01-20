<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ConversationsTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (DB::table('conversations')->count() > 0) {
            return;
        }

        for ($i = 0; $i < 5; $i++) {
            DB::table('conversations')->insert([
                'type' => 'group',
                'name' => 'Conversation '.$i,
                'is_encrypted' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
