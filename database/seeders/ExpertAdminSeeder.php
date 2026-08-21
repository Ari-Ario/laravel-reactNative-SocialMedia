<?php

namespace Database\Seeders;

use App\Models\ExpertDomain;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeds test@example.com as a superadmin (phase=0 = all branches).
 * Run: php artisan db:seed --class=ExpertAdminSeeder
 */
class ExpertAdminSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::where('email', 'test@example.com')->first();
        if (!$user) {
            $this->command->warn('User test@example.com not found. Skipping.');
            return;
        }

        // phase=0 means superadmin — sees all branches
        ExpertDomain::updateOrCreate(
            ['user_id' => $user->id, 'branch' => '*'],
            [
                'domain_partition' => null,
                'phase'            => 0,
            ]
        );

        // Also seed all 6 science phases explicitly for completeness
        $branches = [
            // Phase 1
            ['branch' => 'ontology',             'phase' => 1],
            ['branch' => 'epistemology',          'phase' => 1],
            // Phase 2
            ['branch' => 'formal_logic',          'phase' => 2],
            ['branch' => 'set_theory',            'phase' => 2],
            ['branch' => 'modal_logic',           'phase' => 2],
            ['branch' => 'dialectics',            'phase' => 2],
            // Phase 3
            ['branch' => 'arithmetic',            'phase' => 3],
            ['branch' => 'algebra',               'phase' => 3],
            ['branch' => 'calculus',              'phase' => 3],
            ['branch' => 'number_theory',         'phase' => 3],
            ['branch' => 'topology',              'phase' => 3],
            ['branch' => 'game_theory',           'phase' => 3],
            // Phase 4
            ['branch' => 'classical_mechanics',   'phase' => 4],
            ['branch' => 'quantum_mechanics',     'phase' => 4],
            ['branch' => 'relativity',            'phase' => 4],
            ['branch' => 'thermodynamics',        'phase' => 4],
            ['branch' => 'chemistry',             'phase' => 4],
            // Phase 5
            ['branch' => 'genetics',              'phase' => 5],
            ['branch' => 'evolutionary_biology',  'phase' => 5],
            ['branch' => 'neuroscience',          'phase' => 5],
            ['branch' => 'ecology',               'phase' => 5],
            // Phase 6
            ['branch' => 'computer_science',      'phase' => 6],
            ['branch' => 'economics',             'phase' => 6],
            ['branch' => 'sociology',             'phase' => 6],
            ['branch' => 'law',                   'phase' => 6],
        ];

        foreach ($branches as $b) {
            ExpertDomain::updateOrCreate(
                ['user_id' => $user->id, 'branch' => $b['branch']],
                ['domain_partition' => null, 'phase' => $b['phase']]
            );
        }

        $this->command->info("Expert domains seeded for test@example.com ({$user->id}).");
    }
}
